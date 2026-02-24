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
import { ILogger } from '@theia/core/lib/common/logger';
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
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { OpenCodeService } from '../../common/opencode-protocol';
import * as sinon from 'sinon';

// Minimal mock services for testing path validation logic
class MockWorkspaceService {
    tryGetRoots() {
        return [{ 
            resource: { 
                path: { toString: () => '/workspace/test-project', fsPath: () => '/workspace/test-project' } 
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

// Mock OpenCodeService for validatePath tests
class MockOpenCodeService {
    validatePathCalls: Array<{ filePath: string; workspaceRoot: string }> = [];
    validatePathResult: { valid: boolean; resolvedPath?: string; error?: string } = { valid: true, resolvedPath: undefined };

    async validatePath(filePath: string, workspaceRoot: string): Promise<{ valid: boolean; resolvedPath?: string; error?: string }> {
        this.validatePathCalls.push({ filePath, workspaceRoot });
        return this.validatePathResult;
    }
}

// Simple binding that doesn't require full interface implementation
function createTestContainer(openCodeService?: MockOpenCodeService) {
    const container = new Container();
    
    // Use actual service identifiers for inversify, but cast to any to avoid
    // needing full interface implementation for unit tests
    container.bind(WorkspaceService).toConstantValue(new MockWorkspaceService() as unknown as WorkspaceService);
    container.bind(FileService).toConstantValue(new MockFileService() as unknown as FileService);
    container.bind(EditorManager).toConstantValue(new MockEditorManager() as unknown as EditorManager);
    container.bind(OpenerService).toConstantValue({
        getOpeners: async () => [],
    } as unknown as OpenerService);
    container.bind(ILogger).toConstantValue({
        info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined,
    });
    if (openCodeService) {
        container.bind(OpenCodeService).toConstantValue(openCodeService as unknown as OpenCodeService);
    }
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

    describe('validatePath with OpenCodeService (symlink resolution)', () => {
        let mockOpenCodeService: MockOpenCodeService;
        let contributionWithService: EditorCommandContribution;

        beforeEach(() => {
            mockOpenCodeService = new MockOpenCodeService();
            const containerWithService = createTestContainer(mockOpenCodeService);
            containerWithService.bind(EditorCommandContribution).toSelf();
            contributionWithService = containerWithService.get(EditorCommandContribution);
        });

        it('should call openCodeService.validatePath with the normalized path and workspace root', async () => {
            mockOpenCodeService.validatePathResult = { valid: true, resolvedPath: '/workspace/test-project/src/index.ts' };

            const result = await contributionWithService['validatePath']('src/index.ts');

            expect(result).to.not.be.null;
            expect(mockOpenCodeService.validatePathCalls).to.have.length(1);
            const call = mockOpenCodeService.validatePathCalls[0];
            expect(call.filePath).to.equal('/workspace/test-project/src/index.ts');
            expect(call.workspaceRoot).to.equal('/workspace/test-project');
        });

        it('should return null when openCodeService.validatePath returns invalid', async () => {
            mockOpenCodeService.validatePathResult = {
                valid: false,
                error: 'Path resolves outside workspace: /symlink/path → /etc/passwd'
            };

            const result = await contributionWithService['validatePath']('src/index.ts');

            expect(result).to.be.null;
        });

        it('should use resolvedPath from openCodeService when provided', async () => {
            const resolvedPath = '/workspace/test-project/actual/path/file.ts';
            mockOpenCodeService.validatePathResult = { valid: true, resolvedPath };

            const result = await contributionWithService['validatePath']('src/symlink-dir/file.ts');

            expect(result).to.equal(resolvedPath);
        });
    });

    describe('highlight tracking', () => {
        it('should track highlights in map', () => {
            const highlights = contribution.getTrackedHighlights();
            expect(highlights).to.be.instanceOf(Map);
            expect(highlights.size).to.equal(0);
        });
    });

    describe('open command highlight lifecycle', () => {
        it('triggers line highlight when open args request highlight (REQ-EDT-021)', async () => {
            const openStub = sinon.stub().resolves({ id: 'editor-1' });
            const validatePathStub = sinon.stub().resolves('/workspace/test-project/src/index.ts');
            const highlightCodeStub = sinon.stub().resolves({ success: true, highlightId: 'hl-1' });

            (contribution as any).editorManager = { open: openStub };
            (contribution as any).validatePath = validatePathStub;
            (contribution as any).highlightCode = highlightCodeStub;

            const result = await (contribution as any).openEditor({
                path: 'src/index.ts',
                line: 7,
                highlight: true,
            });

            expect(result.success).to.equal(true);
            expect(result.editorId).to.equal('editor-1');
            expect(highlightCodeStub.calledOnce).to.equal(true);
            expect(highlightCodeStub.firstCall.args[0]).to.deep.equal({
                path: 'src/index.ts',
                ranges: [{ startLine: 7, endLine: 7 }],
            });
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
