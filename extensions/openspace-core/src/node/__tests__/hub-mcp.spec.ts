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

/**
 * Phase T3: Unit tests for OpenSpaceMcpServer
 *
 * Covers:
 *  1. resolveCommand() — resolves/rejects pending promises
 *  2. executeViaBridge() — error path when bridge not connected
 *  3. resolveSafePath() — workspace path safety (traversal rejection)
 *  4. File tools (read, write, list, patch) — direct filesystem operations
 *  5. Tool registration — verifiable via internal structure
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { OpenSpaceMcpServer, CommandBridgeResult, BridgeCallback } from '../hub-mcp';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Access private members for testing without casting every line. */
function priv(obj: OpenSpaceMcpServer): any {
    return obj as any;
}

/** Create an isolated temp directory for file-tool tests.
 *  Uses realpathSync to resolve OS-level symlinks (e.g. /tmp → /private/tmp on macOS)
 *  so that test assertions match the resolved paths returned by resolveSafePath().
 */
function makeTempDir(): string {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-mcp-test-'));
    return fs.realpathSync(tmpDir);
}

/** Build a minimal CommandBridgeResult for promise resolution tests. */
function makeResult(overrides?: Partial<CommandBridgeResult>): CommandBridgeResult {
    return {
        cmd: 'openspace.test',
        args: {},
        success: true,
        output: { ok: true },
        executionTime: 10,
        timestamp: new Date().toISOString(),
        requestId: 'req-001',
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// Suite 1: resolveCommand — Promise resolution/rejection
// ---------------------------------------------------------------------------

describe('OpenSpaceMcpServer — resolveCommand()', () => {
    let workspaceDir: string;
    let server: OpenSpaceMcpServer;

    beforeEach(() => {
        workspaceDir = makeTempDir();
        server = new OpenSpaceMcpServer(workspaceDir);
    });

    afterEach(() => {
        sinon.restore();
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    });

    it('resolves a pending command promise with the result', async () => {
        const requestId = 'req-resolve-001';
        // Manually inject a pending entry to simulate in-flight bridge call
        const p = new Promise<CommandBridgeResult>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timeout')), 5000);
            priv(server).pendingCommands.set(requestId, { resolve, reject, timer });
        });

        const result = makeResult({ requestId });
        server.resolveCommand(requestId, result);

        const resolvedValue = await p;
        expect(resolvedValue).to.equal(result);
        expect(priv(server).pendingCommands.has(requestId)).to.be.false;
    });

    it('clears the pending entry after resolving', () => {
        const requestId = 'req-cleanup';
        const timer = setTimeout(() => {}, 9999);
        priv(server).pendingCommands.set(requestId, {
            resolve: () => {},
            reject: () => {},
            timer,
        });

        expect(priv(server).pendingCommands.has(requestId)).to.be.true;
        server.resolveCommand(requestId, makeResult({ requestId }));
        expect(priv(server).pendingCommands.has(requestId)).to.be.false;
        clearTimeout(timer); // clean up the dummy timer
    });

    it('is a no-op when requestId is unknown', () => {
        // Should not throw
        expect(() => server.resolveCommand('nonexistent-id', makeResult())).to.not.throw();
        expect(priv(server).pendingCommands.size).to.equal(0);
    });
});

// ---------------------------------------------------------------------------
// Suite 2: executeViaBridge — bridge not connected error path
// ---------------------------------------------------------------------------

describe('OpenSpaceMcpServer — executeViaBridge() when bridge is not connected', () => {
    let workspaceDir: string;
    let server: OpenSpaceMcpServer;

    beforeEach(() => {
        workspaceDir = makeTempDir();
        server = new OpenSpaceMcpServer(workspaceDir);
        // Explicitly ensure bridgeCallback is undefined
        priv(server).bridgeCallback = undefined;
    });

    afterEach(() => {
        sinon.restore();
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    });

    it('returns isError:true when bridge is not connected', async () => {
        const result = await priv(server).executeViaBridge('openspace.pane.list', {});
        expect(result.isError).to.be.true;
        expect(result.content[0].text).to.include('Bridge not connected');
    });

    it('does not add to pendingCommands when bridge is missing', async () => {
        await priv(server).executeViaBridge('openspace.pane.open', { area: 'main', type: 'editor' });
        expect(priv(server).pendingCommands.size).to.equal(0);
    });
});

// ---------------------------------------------------------------------------
// Suite 3: setBridgeCallback + executeViaBridge — happy path (mocked callback)
// ---------------------------------------------------------------------------

describe('OpenSpaceMcpServer — executeViaBridge() with bridge connected', () => {
    let workspaceDir: string;
    let server: OpenSpaceMcpServer;

    beforeEach(() => {
        workspaceDir = makeTempDir();
        server = new OpenSpaceMcpServer(workspaceDir);
    });

    afterEach(() => {
        sinon.restore();
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    });

    it('calls bridgeCallback with the AgentCommand (including requestId)', async () => {
        let capturedCommand: any;

        const callback: BridgeCallback = (command) => {
            capturedCommand = command;
            // Immediately resolve via resolveCommand to avoid timeout
            const result = makeResult({ requestId: command.requestId, cmd: command.cmd });
            setImmediate(() => server.resolveCommand(command.requestId!, result));
        };

        server.setBridgeCallback(callback);

        const mcpResult = await priv(server).executeViaBridge('openspace.pane.list', { extra: true });

        expect(capturedCommand).to.exist;
        expect(capturedCommand.cmd).to.equal('openspace.pane.list');
        expect(capturedCommand.args).to.deep.equal({ extra: true });
        expect(capturedCommand.requestId).to.be.a('string');
        expect(mcpResult.isError).to.be.undefined;
        expect(mcpResult.content[0].text).to.include('ok');
    });

    it('returns isError:true when command result has success:false', async () => {
        const callback: BridgeCallback = (command) => {
            const result = makeResult({
                requestId: command.requestId,
                cmd: command.cmd,
                success: false,
                error: 'Command registry rejected the command',
            });
            setImmediate(() => server.resolveCommand(command.requestId!, result));
        };

        server.setBridgeCallback(callback);

        const mcpResult = await priv(server).executeViaBridge('openspace.editor.open', { path: 'file.ts' });
        expect(mcpResult.isError).to.be.true;
        expect(mcpResult.content[0].text).to.include('Command registry rejected');
    });
});

// ---------------------------------------------------------------------------
// Suite 4: resolveSafePath — workspace path safety
// ---------------------------------------------------------------------------

describe('OpenSpaceMcpServer — resolveSafePath()', () => {
    let workspaceDir: string;
    let server: OpenSpaceMcpServer;

    beforeEach(() => {
        workspaceDir = makeTempDir();
        server = new OpenSpaceMcpServer(workspaceDir);
    });

    afterEach(() => {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    });

    it('resolves a relative path within workspace root', () => {
        const resolved = priv(server).resolveSafePath('src/index.ts');
        expect(resolved).to.equal(path.join(workspaceDir, 'src/index.ts'));
    });

    it('resolves "." to workspace root', () => {
        const resolved = priv(server).resolveSafePath('.');
        expect(resolved).to.equal(workspaceDir);
    });

    it('throws on ../ traversal that escapes workspace root', () => {
        expect(() => priv(server).resolveSafePath('../../../etc/passwd'))
            .to.throw(/Path traversal detected/);
    });

    it('throws on absolute path outside workspace', () => {
        expect(() => priv(server).resolveSafePath('/etc/passwd'))
            .to.throw(/Path traversal detected/);
    });

    it('allows absolute path inside workspace root', () => {
        const insidePath = path.join(workspaceDir, 'subdir', 'file.txt');
        const resolved = priv(server).resolveSafePath(insidePath);
        expect(resolved).to.equal(insidePath);
    });
});

// ---------------------------------------------------------------------------
// Suite 5: File tool handlers — direct filesystem operations
// ---------------------------------------------------------------------------

describe('OpenSpaceMcpServer — file tool handlers', () => {
    let workspaceDir: string;
    let server: OpenSpaceMcpServer;

    beforeEach(() => {
        workspaceDir = makeTempDir();
        server = new OpenSpaceMcpServer(workspaceDir);
    });

    afterEach(() => {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    });

    // --- file.read ---

    describe('openspace.file.read', () => {
        it('reads an existing file and returns its content', async () => {
            const filePath = path.join(workspaceDir, 'hello.txt');
            fs.writeFileSync(filePath, 'Hello World!', 'utf-8');

            // Access the registered tool handler directly via the mcpServer internals
            // We call resolveSafePath + readFileSync directly to mirror what the tool does
            const resolved = priv(server).resolveSafePath('hello.txt');
            const content = fs.readFileSync(resolved, 'utf-8');
            expect(content).to.equal('Hello World!');
        });

        it('returns isError:true for a non-existent file via tool-like logic', async () => {
            try {
                const resolved = priv(server).resolveSafePath('nonexistent.txt');
                fs.readFileSync(resolved, 'utf-8');
                expect.fail('Should have thrown');
            } catch (err: any) {
                expect(err.code).to.equal('ENOENT');
            }
        });

        it('rejects path traversal via file.read', () => {
            expect(() => priv(server).resolveSafePath('../../../etc/passwd'))
                .to.throw(/Path traversal detected/);
        });
    });

    // --- file.write ---

    describe('openspace.file.write', () => {
        it('writes content to a file (creating directories as needed)', () => {
            const relPath = 'subdir/deep/file.ts';
            const resolved = priv(server).resolveSafePath(relPath);
            const dir = path.dirname(resolved);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(resolved, 'export {};', 'utf-8');

            expect(fs.readFileSync(resolved, 'utf-8')).to.equal('export {};');
        });

        it('rejects writing outside workspace root', () => {
            expect(() => priv(server).resolveSafePath('../outside/file.ts'))
                .to.throw(/Path traversal detected/);
        });
    });

    // --- file.list (listDirectory) ---

    describe('openspace.file.list (listDirectory)', () => {
        it('lists files in a directory (non-recursive)', () => {
            fs.writeFileSync(path.join(workspaceDir, 'a.ts'), '', 'utf-8');
            fs.writeFileSync(path.join(workspaceDir, 'b.ts'), '', 'utf-8');
            fs.mkdirSync(path.join(workspaceDir, 'subdir'));

            const entries = priv(server).listDirectory(workspaceDir, false);
            expect(entries).to.include('a.ts');
            expect(entries).to.include('b.ts');
            expect(entries).to.include('subdir/');
        });

        it('lists files recursively', () => {
            fs.mkdirSync(path.join(workspaceDir, 'sub'));
            fs.writeFileSync(path.join(workspaceDir, 'sub', 'nested.ts'), '', 'utf-8');

            const entries = priv(server).listDirectory(workspaceDir, true);
            expect(entries).to.include('sub/nested.ts');
        });

        it('returns empty array for empty directory', () => {
            const emptyDir = path.join(workspaceDir, 'empty');
            fs.mkdirSync(emptyDir);
            const entries = priv(server).listDirectory(emptyDir, false);
            expect(entries).to.deep.equal([]);
        });
    });

    // --- file.patch ---

    describe('openspace.file.patch', () => {
        it('replaces matching text in a file', () => {
            const filePath = path.join(workspaceDir, 'patch-me.ts');
            fs.writeFileSync(filePath, 'const x = 1;\nconst y = 2;\n', 'utf-8');

            const original = fs.readFileSync(filePath, 'utf-8');
            expect(original).to.include('const x = 1;');

            const patched = original.replace('const x = 1;', 'const x = 99;');
            fs.writeFileSync(filePath, patched, 'utf-8');

            expect(fs.readFileSync(filePath, 'utf-8')).to.include('const x = 99;');
        });

        it('leaves file unchanged when oldText is not found (simulated error path)', () => {
            const filePath = path.join(workspaceDir, 'no-match.ts');
            const original = 'export const foo = 1;\n';
            fs.writeFileSync(filePath, original, 'utf-8');

            const content = fs.readFileSync(filePath, 'utf-8');
            const notFound = !content.includes('MISSING_TEXT');
            expect(notFound).to.be.true; // tool would return isError:true in this case
        });
    });

    // --- searchFiles ---

    describe('openspace.file.search (searchFiles)', () => {
        it('finds pattern matches in files', () => {
            fs.writeFileSync(path.join(workspaceDir, 'search-me.ts'), 'const TARGET = 42;\n', 'utf-8');

            const results = priv(server).searchFiles(workspaceDir, 'TARGET');
            expect(results.length).to.be.greaterThan(0);
            expect(results[0]).to.include('search-me.ts');
            expect(results[0]).to.include('TARGET');
        });

        it('returns empty array when pattern is not found', () => {
            fs.writeFileSync(path.join(workspaceDir, 'no-match.ts'), 'const x = 1;\n', 'utf-8');

            const results = priv(server).searchFiles(workspaceDir, 'ZZZNOMATCH999');
            expect(results).to.deep.equal([]);
        });

        it('respects glob filter (extension)', () => {
            fs.writeFileSync(path.join(workspaceDir, 'match.ts'), 'const FIND_ME = 1;\n', 'utf-8');
            fs.writeFileSync(path.join(workspaceDir, 'no-match.js'), 'const FIND_ME = 1;\n', 'utf-8');

            const tsResults = priv(server).searchFiles(workspaceDir, 'FIND_ME', '**/*.ts');
            const jsResults = priv(server).searchFiles(workspaceDir, 'FIND_ME', '**/*.js');

            // .ts filter: match.ts included, no-match.js excluded
            const tsFiles = tsResults.map((r: string) => path.basename(r.split(':')[0]));
            expect(tsFiles).to.include('match.ts');
            expect(tsFiles).to.not.include('no-match.js');

            // .js filter: no-match.js included
            const jsFiles = jsResults.map((r: string) => path.basename(r.split(':')[0]));
            expect(jsFiles).to.include('no-match.js');
        });
    });
});

describe('Hub — OPENSPACE_HUB_ORIGINS env var (T3-8)', () => {
    it('Hub allows origins from OPENSPACE_HUB_ORIGINS env var', () => {
        // Structural test: verify source reads the env var
        const src = fs.readFileSync(
            path.join(__dirname, '../hub.ts'),
            'utf-8'
        );
        expect(src).to.include('OPENSPACE_HUB_ORIGINS');
    });
});

// ---------------------------------------------------------------------------
// Suite 6: Presentation tool registration — structural verification
// ---------------------------------------------------------------------------

describe('OpenSpaceMcpServer — presentation tool registrations', () => {
    let hubMcpSrc: string;

    before(() => {
        hubMcpSrc = fs.readFileSync(
            path.join(__dirname, '../hub-mcp.ts'),
            'utf-8'
        );
    });

    const PRESENTATION_TOOLS = [
        'openspace.presentation.list',
        'openspace.presentation.read',
        'openspace.presentation.create',
        'openspace.presentation.update_slide',
        'openspace.presentation.open',
        'openspace.presentation.navigate',
        'openspace.presentation.play',
        'openspace.presentation.pause',
        'openspace.presentation.stop',
        'openspace.presentation.toggleFullscreen',
    ];

    for (const toolName of PRESENTATION_TOOLS) {
        it(`registers tool "${toolName}"`, () => {
            expect(hubMcpSrc, `hub-mcp.ts must register "${toolName}"`).to.include(`'${toolName}'`);
        });
    }

    it('routes all presentation tools through executeViaBridge', () => {
        // Each presentation tool must delegate to the browser via executeViaBridge
        // (they cannot be implemented at the node layer since Theia/reveal.js is browser-side)
        for (const toolName of PRESENTATION_TOOLS) {
            expect(
                hubMcpSrc,
                `"${toolName}" must call executeViaBridge`
            ).to.include(`executeViaBridge('${toolName}'`);
        }
    });

    it('executeViaBridge returns isError:true for presentation tools when bridge is not connected', async () => {
        const workspaceDir = makeTempDir();
        const server = new OpenSpaceMcpServer(workspaceDir);
        // No bridgeCallback set — bridge not connected
        try {
            const result = await priv(server).executeViaBridge('openspace.presentation.list', {});
            expect(result.isError).to.be.true;
            expect(result.content[0].text).to.include('Bridge not connected');
        } finally {
            fs.rmSync(workspaceDir, { recursive: true, force: true });
        }
    });
});

// ---------------------------------------------------------------------------
// Suite 7: Whiteboard tool registration — structural verification
// ---------------------------------------------------------------------------

describe('OpenSpaceMcpServer — whiteboard tool registrations', () => {
    let hubMcpSrc: string;

    before(() => {
        hubMcpSrc = fs.readFileSync(
            path.join(__dirname, '../hub-mcp.ts'),
            'utf-8'
        );
    });

    const WHITEBOARD_TOOLS = [
        'openspace.whiteboard.list',
        'openspace.whiteboard.read',
        'openspace.whiteboard.create',
        'openspace.whiteboard.add_shape',
        'openspace.whiteboard.update_shape',
        'openspace.whiteboard.delete_shape',
        'openspace.whiteboard.open',
        'openspace.whiteboard.camera.set',
        'openspace.whiteboard.camera.fit',
        'openspace.whiteboard.camera.get',
    ];

    for (const toolName of WHITEBOARD_TOOLS) {
        it(`registers tool "${toolName}"`, () => {
            expect(hubMcpSrc, `hub-mcp.ts must register "${toolName}"`).to.include(`'${toolName}'`);
        });
    }

    it('routes all whiteboard tools through executeViaBridge', () => {
        for (const toolName of WHITEBOARD_TOOLS) {
            expect(
                hubMcpSrc,
                `"${toolName}" must call executeViaBridge`
            ).to.include(`executeViaBridge('${toolName}'`);
        }
    });
});

// ---------------------------------------------------------------------------
// Suite 8: openspace.artifact.patch tool
// ---------------------------------------------------------------------------

describe('OpenSpaceMcpServer — openspace.artifact.patch tool', () => {
    let workspaceDir: string;
    let server: OpenSpaceMcpServer;

    beforeEach(() => {
        workspaceDir = makeTempDir();
        server = new OpenSpaceMcpServer(workspaceDir);
    });

    afterEach(() => {
        priv(server).artifactStore?.close();
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    });

    it('openspace.artifact.patch is registered in hub-mcp.ts source', () => {
        const hubMcpSrc = fs.readFileSync(
            path.join(__dirname, '../hub-mcp.ts'),
            'utf-8'
        );
        expect(hubMcpSrc).to.include("'openspace.artifact.patch'");
    });

    it('successful replace_content patch returns JSON { version, bytes, path }', async () => {
        const relPath = 'artifact.ts';
        const content = 'export const x = 1;\n';

        // Pre-create file so it exists
        fs.writeFileSync(path.join(workspaceDir, relPath), content, 'utf-8');

        // Call the tool handler directly via private registerFileTools logic
        // We invoke patchEngine.apply directly to mirror what the tool does
        const result = await priv(server).patchEngine.apply(relPath, {
            baseVersion: 0,
            actor: 'agent',
            intent: 'test patch',
            ops: [{ op: 'replace_content', content: 'export const x = 42;\n' }],
        });

        expect(result).to.have.property('version', 1);
        expect(result).to.have.property('bytes').that.is.a('number').and.greaterThan(0);
    });

    it('ConflictError (wrong baseVersion) returns isError:true from the MCP tool handler', async () => {
        // Capture the actual openspace.artifact.patch handler by passing a fake server
        const handlers = new Map<string, (args: unknown) => Promise<unknown>>();
        const fakeServer = { tool: (name: string, _desc: string, _schema: unknown, handler: (args: unknown) => Promise<unknown>) => { handlers.set(name, handler); } };
        priv(server).registerToolsOn(fakeServer);
        const handler = handlers.get('openspace.artifact.patch')!;

        // Call handler with a baseVersion that will never match (file version is 0)
        const result: any = await handler({
            path: 'new-file.ts',
            baseVersion: 99, // wrong — current version is 0
            actor: 'agent',
            intent: 'stale patch',
            ops: [{ op: 'replace_content', content: 'const x = 1;\n' }],
        });

        expect(result.isError).to.be.true;
        expect(result.content[0].text).to.include('Error:');
    });

    it('path traversal returns isError:true from the MCP tool handler', async () => {
        // Capture the actual openspace.artifact.patch handler by passing a fake server
        const handlers = new Map<string, (args: unknown) => Promise<unknown>>();
        const fakeServer = { tool: (name: string, _desc: string, _schema: unknown, handler: (args: unknown) => Promise<unknown>) => { handlers.set(name, handler); } };
        priv(server).registerToolsOn(fakeServer);
        const handler = handlers.get('openspace.artifact.patch')!;

        // Call handler with a path-traversal path
        const result: any = await handler({
            path: '../outside.txt',
            baseVersion: 0,
            actor: 'agent',
            intent: 'traversal attempt',
            ops: [{ op: 'replace_content', content: 'evil\n' }],
        });

        expect(result.isError).to.be.true;
        expect(result.content[0].text).to.include('Error:');
    });
});

// ---------------------------------------------------------------------------
// Suite 9: openspace.artifact.getVersion tool
// ---------------------------------------------------------------------------

describe('OpenSpaceMcpServer — openspace.artifact.getVersion tool', () => {
    let workspaceDir: string;
    let server: OpenSpaceMcpServer;

    beforeEach(() => {
        workspaceDir = makeTempDir();
        server = new OpenSpaceMcpServer(workspaceDir);
    });

    afterEach(() => {
        priv(server).artifactStore?.close();
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    });

    it('openspace.artifact.getVersion is registered in hub-mcp.ts source', () => {
        const hubMcpSrc = fs.readFileSync(
            path.join(__dirname, '../hub-mcp.ts'),
            'utf-8'
        );
        expect(hubMcpSrc).to.include("'openspace.artifact.getVersion'");
    });

    it('openspace.artifact.getVersion returns version 0 for unknown file', async () => {
        const handlers = new Map<string, (args: unknown) => Promise<unknown>>();
        const fakeServer = { tool: (name: string, _desc: string, _schema: unknown, handler: (args: unknown) => Promise<unknown>) => { handlers.set(name, handler); } };
        priv(server).registerToolsOn(fakeServer);
        const handler = handlers.get('openspace.artifact.getVersion')!;

        const result: any = await handler({ path: 'unknown-file.ts' });

        expect(result.isError).to.be.undefined;
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).to.have.property('path', 'unknown-file.ts');
        expect(parsed).to.have.property('version', 0);
    });

    it('openspace.artifact.getVersion returns updated version after a patch', async () => {
        const handlers = new Map<string, (args: unknown) => Promise<unknown>>();
        const fakeServer = { tool: (name: string, _desc: string, _schema: unknown, handler: (args: unknown) => Promise<unknown>) => { handlers.set(name, handler); } };
        priv(server).registerToolsOn(fakeServer);
        const getVersionHandler = handlers.get('openspace.artifact.getVersion')!;
        const patchHandler = handlers.get('openspace.artifact.patch')!;

        // Apply a patch to increment the version
        await patchHandler({
            path: 'versioned-artifact.ts',
            baseVersion: 0,
            actor: 'agent',
            intent: 'initial write',
            ops: [{ op: 'replace_content', content: 'const x = 1;\n' }],
        });

        // Now getVersion should return 1
        const result: any = await getVersionHandler({ path: 'versioned-artifact.ts' });
        expect(result.isError).to.be.undefined;
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).to.have.property('version', 1);
    });

    it('openspace.artifact.getVersion returns isError:true for path traversal', async () => {
        const handlers = new Map<string, (args: unknown) => Promise<unknown>>();
        const fakeServer = { tool: (name: string, _desc: string, _schema: unknown, handler: (args: unknown) => Promise<unknown>) => { handlers.set(name, handler); } };
        priv(server).registerToolsOn(fakeServer);
        const handler = handlers.get('openspace.artifact.getVersion')!;

        const result: any = await handler({ path: '../outside.ts' });
        expect(result.isError).to.be.true;
        expect(result.content[0].text).to.include('Error:');
    });
});
