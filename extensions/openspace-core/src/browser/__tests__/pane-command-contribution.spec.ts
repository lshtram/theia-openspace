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

import { Container } from '@theia/core/shared/inversify';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { expect } from 'chai';
import { PaneService } from '../pane-service';
import { 
    PaneCommandContribution, 
    PaneCommands,
    PANE_OPEN_SCHEMA,
    PANE_CLOSE_SCHEMA,
    PANE_FOCUS_SCHEMA,
    PANE_LIST_SCHEMA,
    PANE_RESIZE_SCHEMA
} from '../pane-command-contribution';

// Mock PaneService for testing
class MockPaneService implements PaneService {
    onPaneLayoutChanged = {
        event: () => () => {}
    } as any;
    
    dispose(): void {}

    async openContent(args: { type: string; contentId: string; title?: string; splitDirection?: string }): Promise<{ success: boolean; paneId?: string }> {
        if (args.type === 'editor' || args.type === 'terminal' || args.type === 'presentation' || args.type === 'whiteboard') {
            return { success: true, paneId: `${args.type}-${args.contentId}-123` };
        }
        return { success: false };
    }

    async closeContent(args: { paneId: string }): Promise<{ success: boolean }> {
        if (args.paneId.startsWith('valid-')) {
            return { success: true };
        }
        return { success: false };
    }

    async focusContent(args: { paneId: string }): Promise<{ success: boolean }> {
        if (args.paneId.startsWith('valid-')) {
            return { success: true };
        }
        return { success: false };
    }

    async listPanes(): Promise<any[]> {
        return [
            { id: 'pane-1', area: 'main', title: 'Editor 1', tabs: [] },
            { id: 'pane-2', area: 'bottom', title: 'Terminal', tabs: [] }
        ];
    }

    async resizePane(args: { paneId: string; width?: number; height?: number }): Promise<{ success: boolean }> {
        if (args.paneId.startsWith('valid-')) {
            return { success: true };
        }
        return { success: false };
    }

    trackAgentPane(_paneId: string, _pinned?: boolean): void {}
    getAgentPanes(): any[] { return []; }
}

describe('PaneCommandContribution', () => {
    let container: Container;
    let commandRegistry: CommandRegistry;
    let paneService: MockPaneService;
    let contribution: PaneCommandContribution;

    beforeEach(() => {
        container = new Container();
        
        // Bind mock PaneService
        paneService = new MockPaneService();
        container.bind(PaneService).toConstantValue(paneService);
        
        // Bind CommandContribution
        container.bind(PaneCommandContribution).toSelf();
        
        contribution = container.get(PaneCommandContribution);
        
        // Create fresh CommandRegistry for each test
        commandRegistry = new CommandRegistry({
            getContributions: () => []
        } as any);
    });

    describe('registerCommands', () => {
        it('should register openspace.pane.open command', () => {
            // Act
            contribution.registerCommands(commandRegistry);
            
            // Assert
            const command = commandRegistry.getCommand(PaneCommands.OPEN);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.pane.open');
            expect(command?.label).to.equal('OpenSpace: Open Pane');
        });

        it('should register openspace.pane.close command', () => {
            // Act
            contribution.registerCommands(commandRegistry);
            
            // Assert
            const command = commandRegistry.getCommand(PaneCommands.CLOSE);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.pane.close');
            expect(command?.label).to.equal('OpenSpace: Close Pane');
        });

        it('should register openspace.pane.focus command', () => {
            // Act
            contribution.registerCommands(commandRegistry);
            
            // Assert
            const command = commandRegistry.getCommand(PaneCommands.FOCUS);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.pane.focus');
            expect(command?.label).to.equal('OpenSpace: Focus Pane');
        });

        it('should register openspace.pane.list command', () => {
            // Act
            contribution.registerCommands(commandRegistry);
            
            // Assert
            const command = commandRegistry.getCommand(PaneCommands.LIST);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.pane.list');
            expect(command?.label).to.equal('OpenSpace: List Panes');
        });

        it('should register openspace.pane.resize command', () => {
            // Act
            contribution.registerCommands(commandRegistry);
            
            // Assert
            const command = commandRegistry.getCommand(PaneCommands.RESIZE);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.pane.resize');
            expect(command?.label).to.equal('OpenSpace: Resize Pane');
        });

        it('should register all 5 pane commands', () => {
            // Act
            contribution.registerCommands(commandRegistry);
            
            // Assert
            const commands = commandRegistry.commands;
            const paneCommands = commands.filter(c => c.id.startsWith('openspace.pane.'));
            expect(paneCommands).to.have.length(5);
        });
    });

    describe('command schemas', () => {
        it('should export PANE_OPEN_SCHEMA', () => {
            expect(PANE_OPEN_SCHEMA).to.not.be.undefined;
            expect(PANE_OPEN_SCHEMA.type).to.equal('object');
            expect(PANE_OPEN_SCHEMA.properties.type.enum).to.include('editor');
            expect(PANE_OPEN_SCHEMA.properties.type.enum).to.include('terminal');
            expect(PANE_OPEN_SCHEMA.required).to.include('type');
            expect(PANE_OPEN_SCHEMA.required).to.include('contentId');
        });

        it('should export PANE_CLOSE_SCHEMA', () => {
            expect(PANE_CLOSE_SCHEMA).to.not.be.undefined;
            expect(PANE_CLOSE_SCHEMA.type).to.equal('object');
            expect(PANE_CLOSE_SCHEMA.required).to.include('paneId');
        });

        it('should export PANE_FOCUS_SCHEMA', () => {
            expect(PANE_FOCUS_SCHEMA).to.not.be.undefined;
            expect(PANE_FOCUS_SCHEMA.type).to.equal('object');
            expect(PANE_FOCUS_SCHEMA.required).to.include('paneId');
        });

        it('should export PANE_LIST_SCHEMA', () => {
            expect(PANE_LIST_SCHEMA).to.not.be.undefined;
            expect(PANE_LIST_SCHEMA.type).to.equal('object');
        });

        it('should export PANE_RESIZE_SCHEMA', () => {
            expect(PANE_RESIZE_SCHEMA).to.not.be.undefined;
            expect(PANE_RESIZE_SCHEMA.type).to.equal('object');
            expect(PANE_RESIZE_SCHEMA.required).to.include('paneId');
        });
    });

    describe('command execution', () => {
        it('should delegate openspace.pane.open to paneService', async () => {
            // Arrange
            contribution.registerCommands(commandRegistry);
            const args = { type: 'editor', contentId: 'test.ts' };
            
            // Act
            const result = await commandRegistry.executeCommand(PaneCommands.OPEN, args);
            
            // Assert
            expect(result).to.deep.equal({ success: true, paneId: 'editor-test.ts-123' });
        });

        it('should delegate openspace.pane.close to paneService', async () => {
            // Arrange
            contribution.registerCommands(commandRegistry);
            const args = { paneId: 'valid-pane-1' };
            
            // Act
            const result = await commandRegistry.executeCommand(PaneCommands.CLOSE, args);
            
            // Assert
            expect(result).to.deep.equal({ success: true });
        });

        it('should delegate openspace.pane.focus to paneService', async () => {
            // Arrange
            contribution.registerCommands(commandRegistry);
            const args = { paneId: 'valid-pane-1' };
            
            // Act
            const result = await commandRegistry.executeCommand(PaneCommands.FOCUS, args);
            
            // Assert
            expect(result).to.deep.equal({ success: true });
        });

        it('should delegate openspace.pane.list to paneService', async () => {
            // Arrange
            contribution.registerCommands(commandRegistry);
            
            // Act
            const result = await commandRegistry.executeCommand(PaneCommands.LIST);
            
            // Assert
            expect(result).to.have.property('panes');
            expect((result as any).panes).to.have.length(2);
        });

        it('should delegate openspace.pane.resize to paneService', async () => {
            // Arrange
            contribution.registerCommands(commandRegistry);
            const args = { paneId: 'valid-pane-1', width: 50, height: 50 };
            
            // Act
            const result = await commandRegistry.executeCommand(PaneCommands.RESIZE, args);
            
            // Assert
            expect(result).to.deep.equal({ success: true });
        });
    });

    describe('PaneCommands constant', () => {
        it('should have OPEN command ID', () => {
            expect(PaneCommands.OPEN).to.equal('openspace.pane.open');
        });

        it('should have CLOSE command ID', () => {
            expect(PaneCommands.CLOSE).to.equal('openspace.pane.close');
        });

        it('should have FOCUS command ID', () => {
            expect(PaneCommands.FOCUS).to.equal('openspace.pane.focus');
        });

        it('should have LIST command ID', () => {
            expect(PaneCommands.LIST).to.equal('openspace.pane.list');
        });

        it('should have RESIZE command ID', () => {
            expect(PaneCommands.RESIZE).to.equal('openspace.pane.resize');
        });
    });
});
