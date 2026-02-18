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
import {
    EditorCommandContribution,
    EditorCommands,
    EDITOR_OPEN_SCHEMA,
    EDITOR_SCROLL_SCHEMA,
    EDITOR_HIGHLIGHT_SCHEMA,
    EDITOR_CLEAR_HIGHLIGHT_SCHEMA,
    EDITOR_READ_FILE_SCHEMA,
    EDITOR_CLOSE_SCHEMA
} from '../editor-command-contribution';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';

// Minimal mock services for testing path validation logic
class MockWorkspaceService {
    tryGetRoots() {
        return [{ 
            resource: { 
                path: { toString: () => '/workspace/test-project' } 
            } as any, 
            name: 'test-project',
            isFile: () => false,
            isDirectory: () => true,
            isSymbolicLink: () => false,
            isReadonly: () => false,
            mtime: 0,
            ctime: 0,
            etag: ''
        }];
    }
}

class MockFileService {
    async read() {
        return { 
            value: 'file content',
            encoding: 'utf-8',
            mtime: 0,
            ctime: 0,
            etag: '',
            isReadonly: false,
            resource: { toString: () => '' }
        };
    }
}

class MockEditorManager {
    readonly id = 'mock-editor-manager';
    readonly label = 'Mock Editor Manager';
    get all() { return []; }
}

// Simple binding that doesn't require full interface implementation
function createTestContainer() {
    const container = new Container();
    
    // Use actual service identifiers for inversify, but cast to any to avoid
    // needing full interface implementation for unit tests
    container.bind(WorkspaceService).toConstantValue(new MockWorkspaceService() as unknown as WorkspaceService);
    container.bind(FileService).toConstantValue(new MockFileService() as unknown as FileService);
    container.bind(EditorManager).toConstantValue(new MockEditorManager() as unknown as EditorManager);
    return container;
}

describe('EditorCommandContribution', () => {
    let container: Container;
    let commandRegistry: CommandRegistry;
    let contribution: EditorCommandContribution;

    beforeEach(() => {
        container = createTestContainer();
        
        // Bind CommandContribution
        container.bind(EditorCommandContribution).toSelf();
        
        contribution = container.get(EditorCommandContribution);
        
        // Create fresh CommandRegistry for each test
        commandRegistry = new CommandRegistry({
            getContributions: () => []
        } as any);
    });

    describe('registerCommands', () => {
        it('should register openspace.editor.open command', () => {
            contribution.registerCommands(commandRegistry);
            
            const command = commandRegistry.getCommand(EditorCommands.OPEN);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.editor.open');
            expect(command?.label).to.equal('OpenSpace: Open File');
        });

        it('should register openspace.editor.scroll_to command', () => {
            contribution.registerCommands(commandRegistry);
            
            const command = commandRegistry.getCommand(EditorCommands.SCROLL_TO);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.editor.scroll_to');
            expect(command?.label).to.equal('OpenSpace: Scroll to Line');
        });

        it('should register openspace.editor.highlight command', () => {
            contribution.registerCommands(commandRegistry);
            
            const command = commandRegistry.getCommand(EditorCommands.HIGHLIGHT);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.editor.highlight');
            expect(command?.label).to.equal('OpenSpace: Highlight Code');
        });

        it('should register openspace.editor.clear_highlight command', () => {
            contribution.registerCommands(commandRegistry);
            
            const command = commandRegistry.getCommand(EditorCommands.CLEAR_HIGHLIGHT);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.editor.clear_highlight');
            expect(command?.label).to.equal('OpenSpace: Clear Highlight');
        });

        it('should register openspace.editor.read_file command', () => {
            contribution.registerCommands(commandRegistry);
            
            const command = commandRegistry.getCommand(EditorCommands.READ_FILE);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.editor.read_file');
            expect(command?.label).to.equal('OpenSpace: Read File');
        });

        it('should register openspace.editor.close command', () => {
            contribution.registerCommands(commandRegistry);
            
            const command = commandRegistry.getCommand(EditorCommands.CLOSE);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.editor.close');
            expect(command?.label).to.equal('OpenSpace: Close File');
        });

        it('should register all 6 editor commands', () => {
            contribution.registerCommands(commandRegistry);
            
            const commands = commandRegistry.commands;
            const editorCommands = commands.filter(c => c.id.startsWith('openspace.editor.'));
            expect(editorCommands).to.have.length(6);
        });
    });

    describe('EditorCommands constant', () => {
        it('should have OPEN command ID', () => {
            expect(EditorCommands.OPEN).to.equal('openspace.editor.open');
        });

        it('should have SCROLL_TO command ID', () => {
            expect(EditorCommands.SCROLL_TO).to.equal('openspace.editor.scroll_to');
        });

        it('should have HIGHLIGHT command ID', () => {
            expect(EditorCommands.HIGHLIGHT).to.equal('openspace.editor.highlight');
        });

        it('should have CLEAR_HIGHLIGHT command ID', () => {
            expect(EditorCommands.CLEAR_HIGHLIGHT).to.equal('openspace.editor.clear_highlight');
        });

        it('should have READ_FILE command ID', () => {
            expect(EditorCommands.READ_FILE).to.equal('openspace.editor.read_file');
        });

        it('should have CLOSE command ID', () => {
            expect(EditorCommands.CLOSE).to.equal('openspace.editor.close');
        });
    });

    describe('path validation', () => {
        it('should accept valid file paths', async () => {
            const result = await contribution['validatePath']('src/index.ts');
            expect(result).to.not.be.null;
            expect(result).to.include('src/index.ts');
        });

        it('should reject path traversal with ..', async () => {
            const result = await contribution['validatePath']('../etc/passwd');
            expect(result).to.be.null;
        });

        it('should reject .env files', async () => {
            const result = await contribution['validatePath']('.env');
            expect(result).to.be.null;
        });

        it('should reject .git directory', async () => {
            const result = await contribution['validatePath']('.git/config');
            expect(result).to.be.null;
        });

        it('should reject id_rsa files', async () => {
            const result = await contribution['validatePath']('~/.ssh/id_rsa');
            expect(result).to.be.null;
        });

        it('should reject .pem files', async () => {
            const result = await contribution['validatePath']('secrets/cert.pem');
            expect(result).to.be.null;
        });

        it('should reject secrets directory', async () => {
            const result = await contribution['validatePath']('config/secrets.json');
            expect(result).to.be.null;
        });

        it('should reject .aws credentials', async () => {
            const result = await contribution['validatePath']('.aws/credentials');
            expect(result).to.be.null;
        });
    });

    describe('highlight tracking', () => {
        it('should track highlights in map', () => {
            const highlights = contribution.getTrackedHighlights();
            expect(highlights).to.be.instanceOf(Map);
            expect(highlights.size).to.equal(0);
        });
    });

    describe('command schemas', () => {
        it('should export EDITOR_OPEN_SCHEMA', () => {
            expect(EDITOR_OPEN_SCHEMA).to.not.be.undefined;
            expect(EDITOR_OPEN_SCHEMA.type).to.equal('object');
            expect(EDITOR_OPEN_SCHEMA.properties.path).to.not.be.undefined;
            expect(EDITOR_OPEN_SCHEMA.required).to.include('path');
        });

        it('should export EDITOR_SCROLL_SCHEMA', () => {
            expect(EDITOR_SCROLL_SCHEMA).to.not.be.undefined;
            expect(EDITOR_SCROLL_SCHEMA.type).to.equal('object');
            expect(EDITOR_SCROLL_SCHEMA.required).to.include('path');
            expect(EDITOR_SCROLL_SCHEMA.required).to.include('line');
        });

        it('should export EDITOR_HIGHLIGHT_SCHEMA', () => {
            expect(EDITOR_HIGHLIGHT_SCHEMA).to.not.be.undefined;
            expect(EDITOR_HIGHLIGHT_SCHEMA.type).to.equal('object');
            expect(EDITOR_HIGHLIGHT_SCHEMA.required).to.include('path');
            expect(EDITOR_HIGHLIGHT_SCHEMA.required).to.include('ranges');
        });

        it('should export EDITOR_CLEAR_HIGHLIGHT_SCHEMA', () => {
            expect(EDITOR_CLEAR_HIGHLIGHT_SCHEMA).to.not.be.undefined;
            expect(EDITOR_CLEAR_HIGHLIGHT_SCHEMA.type).to.equal('object');
            expect(EDITOR_CLEAR_HIGHLIGHT_SCHEMA.required).to.include('highlightId');
        });

        it('should export EDITOR_READ_FILE_SCHEMA', () => {
            expect(EDITOR_READ_FILE_SCHEMA).to.not.be.undefined;
            expect(EDITOR_READ_FILE_SCHEMA.type).to.equal('object');
            expect(EDITOR_READ_FILE_SCHEMA.required).to.include('path');
        });

        it('should export EDITOR_CLOSE_SCHEMA', () => {
            expect(EDITOR_CLOSE_SCHEMA).to.not.be.undefined;
            expect(EDITOR_CLOSE_SCHEMA.type).to.equal('object');
            expect(EDITOR_CLOSE_SCHEMA.required).to.include('path');
        });
    });
});
