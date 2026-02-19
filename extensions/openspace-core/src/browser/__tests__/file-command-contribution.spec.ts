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
import { FileCommandContribution, FileCommands } from '../file-command-contribution';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';

// Mock workspace root for testing
const MOCK_WORKSPACE_ROOT = '/workspace/test-project';

// Minimal mock services for testing path validation logic
class MockWorkspaceService {
    tryGetRoots() {
        return [{ 
            resource: { 
                path: { toString: () => MOCK_WORKSPACE_ROOT, fsPath: () => MOCK_WORKSPACE_ROOT } 
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
    async resolve(uri: any) {
        return {
            isDirectory: true,
            isFile: false,
            name: 'test',
            resource: uri,
            children: [
                { name: 'file1.ts', resource: { path: { toString: () => '/workspace/test-project/file1.ts' } }, isDirectory: false, isFile: true },
                { name: 'file2.ts', resource: { path: { toString: () => '/workspace/test-project/file2.ts' } }, isDirectory: false, isFile: true },
                { name: 'subdir', resource: { path: { toString: () => '/workspace/test-project/subdir' } }, isDirectory: true, isFile: false }
            ]
        };
    }
    async read(uri: any) {
        return { value: 'file content', encoding: 'utf-8' };
    }
    async write(uri: any, content: string) {
        return;
    }
    async createFolder(uri: any) {
        return;
    }
}

// Simple binding that doesn't require full interface implementation
function createTestContainer() {
    const container = new Container();
    
    // Use actual service identifiers for inversify, but cast to any to avoid
    // needing full interface implementation for unit tests
    container.bind(WorkspaceService).toConstantValue(new MockWorkspaceService() as unknown as WorkspaceService);
    container.bind(FileService).toConstantValue(new MockFileService() as unknown as FileService);
    container.bind(ILogger).toConstantValue({
        info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined,
    });
    return container;
}

describe('FileCommandContribution', () => {
    let container: Container;
    let commandRegistry: CommandRegistry;
    let contribution: FileCommandContribution;

    beforeEach(() => {
        container = createTestContainer();
        
        // Bind CommandContribution
        container.bind(FileCommandContribution).toSelf();
        
        contribution = container.get(FileCommandContribution);
        
        // Create fresh CommandRegistry for each test
        commandRegistry = new CommandRegistry({
            getContributions: () => []
        } as any);
    });

    describe('registerCommands', () => {
        it('should register openspace.file.read command', () => {
            contribution.registerCommands(commandRegistry);
            
            const command = commandRegistry.getCommand(FileCommands.READ);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.file.read');
            expect(command?.label).to.equal('OpenSpace: Read File');
        });

        it('should register openspace.file.write command', () => {
            contribution.registerCommands(commandRegistry);
            
            const command = commandRegistry.getCommand(FileCommands.WRITE);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.file.write');
            expect(command?.label).to.equal('OpenSpace: Write File');
        });

        it('should register openspace.file.list command', () => {
            contribution.registerCommands(commandRegistry);
            
            const command = commandRegistry.getCommand(FileCommands.LIST);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.file.list');
            expect(command?.label).to.equal('OpenSpace: List Files');
        });

        it('should register openspace.file.search command', () => {
            contribution.registerCommands(commandRegistry);
            
            const command = commandRegistry.getCommand(FileCommands.SEARCH);
            expect(command).to.not.be.undefined;
            expect(command?.id).to.equal('openspace.file.search');
            expect(command?.label).to.equal('OpenSpace: Search Files');
        });

        it('should register all 4 file commands', () => {
            contribution.registerCommands(commandRegistry);
            
            const commands = commandRegistry.commands;
            const fileCommands = commands.filter(c => c.id.startsWith('openspace.file.'));
            expect(fileCommands).to.have.length(4);
        });
    });

    describe('validatePath', () => {
        it('should accept valid relative path', async () => {
            const result = await contribution.validatePath('src/index.ts');
            expect(result).to.not.be.null;
            expect(result).to.include('src/index.ts');
        });

        it('should accept valid absolute path within workspace', async () => {
            const result = await contribution.validatePath('/workspace/test-project/src/index.ts');
            expect(result).to.not.be.null;
            expect(result).to.include('src/index.ts');
        });

        it('should reject path traversal (..)', async () => {
            const result = await contribution.validatePath('../etc/passwd');
            expect(result).to.be.null;
        });

        it('should reject path traversal with multiple ..', async () => {
            const result = await contribution.validatePath('../../etc/passwd');
            expect(result).to.be.null;
        });

        it('should reject path outside workspace', async () => {
            const result = await contribution.validatePath('/etc/passwd');
            expect(result).to.be.null;
        });

        it('should reject .env file (sensitive)', async () => {
            const result = await contribution.validatePath('.env');
            expect(result).to.be.null;
        });

        it('should reject .env.local file (sensitive)', async () => {
            const result = await contribution.validatePath('.env.local');
            expect(result).to.be.null;
        });

        it('should reject .git/config file (sensitive)', async () => {
            const result = await contribution.validatePath('.git/config');
            expect(result).to.be.null;
        });

        it('should reject id_rsa file (sensitive)', async () => {
            const result = await contribution.validatePath('id_rsa');
            expect(result).to.be.null;
        });

        it('should reject .pem file (sensitive)', async () => {
            const result = await contribution.validatePath('keys.pem');
            expect(result).to.be.null;
        });

        it('should reject .key file (sensitive)', async () => {
            const result = await contribution.validatePath('private.key');
            expect(result).to.be.null;
        });

        it('should reject credentials.json (sensitive)', async () => {
            const result = await contribution.validatePath('credentials.json');
            expect(result).to.be.null;
        });

        it('should reject secrets.json (sensitive)', async () => {
            const result = await contribution.validatePath('secrets.json');
            expect(result).to.be.null;
        });

        it('should reject secrets.config (sensitive)', async () => {
            const result = await contribution.validatePath('secrets.config');
            expect(result).to.be.null;
        });
    });

    describe('validateWritePath', () => {
        it('should accept valid write path', async () => {
            const result = await contribution.validateWritePath('new-file.txt');
            expect(result).to.not.be.null;
        });

        it('should reject write to .git directory', async () => {
            const result = await contribution.validateWritePath('.git/config');
            expect(result).to.be.null;
        });

        it('should reject write to node_modules', async () => {
            const result = await contribution.validateWritePath('node_modules/some-package/index.js');
            expect(result).to.be.null;
        });

        it('should reject write to .theia directory', async () => {
            const result = await contribution.validateWritePath('.theia/settings.json');
            expect(result).to.be.null;
        });
    });

    describe('isSensitive', () => {
        it('should return true for .env', () => {
            expect(contribution.isSensitive('.env')).to.be.true;
        });

        it('should return true for .git/config', () => {
            expect(contribution.isSensitive('.git/config')).to.be.true;
        });

        it('should return false for normal file', () => {
            expect(contribution.isSensitive('src/index.ts')).to.be.false;
        });
    });

    describe('isCriticalWritePath', () => {
        it('should return true for .git/', () => {
            expect(contribution.isCriticalWritePath('.git/config')).to.be.true;
        });

        it('should return true for node_modules/', () => {
            expect(contribution.isCriticalWritePath('node_modules/pkg/index.js')).to.be.true;
        });

        it('should return true for .theia/', () => {
            expect(contribution.isCriticalWritePath('.theia/settings.json')).to.be.true;
        });

        it('should return false for normal file', () => {
            expect(contribution.isCriticalWritePath('src/index.ts')).to.be.false;
        });
    });
});
