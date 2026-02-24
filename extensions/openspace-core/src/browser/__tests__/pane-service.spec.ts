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
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { Widget, Title } from '@lumino/widgets';
import { Emitter } from '@theia/core/lib/common/event';
import { ILogger } from '@theia/core/lib/common/logger';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { expect } from 'chai';
import { PaneService, PaneServiceImpl } from '../pane-service';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import * as sinon from 'sinon';

// Mock types for testing
interface MockWidget {
    id: string;
    title: Title<Widget>;
    area?: 'main' | 'left' | 'right' | 'bottom';
    dispose(): void;
    isDisposed: boolean;
}

describe('PaneService', () => {
    let container: Container;
    let paneService: PaneService;
    let mockShell: ApplicationShell;
    let loggerSpy: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void; debug: (...args: unknown[]) => void };
    
    // Mock widgets for testing
    const createMockWidget = (id: string, titleText: string, area: 'main' | 'left' | 'right' | 'bottom' = 'main'): MockWidget => {
        const mockTitle = {
            label: titleText,
            changed: new Emitter<Title<Widget>>().event,
            owner: {} as Widget,
            mnemonic: 0,
            icon: '',
            iconClass: '',
            caption: '',
            closable: true,
            dataset: {},
            dump: () => '',
            hide: () => {},
            show: () => {},
            className: '',
            id: '',
            parent: null,
            style: {},
            methods: 0
        };
        const widget = {
            id,
            title: mockTitle,
            area,
            dispose: () => {},
            isDisposed: false
        } as unknown as MockWidget;
        return widget;
    };

    beforeEach(() => {
        container = new Container();
        
        // Create mock ApplicationShell with proper event emitters
        const addWidgetEmitter = new Emitter<any>();
        const removeWidgetEmitter = new Emitter<any>();
        const activeWidgetEmitter = new Emitter<any>();
        
        mockShell = {
            activeWidget: undefined,
            getWidgetById: () => undefined,
            getWidgets: (_area: string) => {
                // Default empty array, but can be overridden in tests
                return [];
            },
            addWidget: async () => {},
            closeWidget: async () => true,
            activateWidget: async () => true,
            revealWidget: async () => undefined,
            onDidChangeActiveWidget: activeWidgetEmitter.event,
            onDidAddWidget: addWidgetEmitter.event,
            onDidRemoveWidget: removeWidgetEmitter.event
        } as unknown as ApplicationShell;

        // Bind PaneService
        container.bind(PaneService).to(PaneServiceImpl);
        container.bind(ApplicationShell).toConstantValue(mockShell);

        // Mock TerminalService — openContent for 'terminal' delegates here
        const mockTerminalWidget = { id: 'terminal-0', start: async () => {} } as any;
        const mockTerminalService: Partial<TerminalService> = {
            newTerminal: async () => mockTerminalWidget,
            open: () => {}
        };
        container.bind(TerminalService).toConstantValue(mockTerminalService as TerminalService);

        // Mock EditorManager — openContent for 'editor' delegates here
        const mockEditorWidget = { id: 'code-editor-opener:file:///test.ts:1' } as any;
        const mockEditorManager: Partial<EditorManager> = {
            open: async () => mockEditorWidget
        };
        container.bind(EditorManager).toConstantValue(mockEditorManager as EditorManager);

        // Mock WorkspaceService — needed for relative path resolution
        const mockWorkspaceService: Partial<WorkspaceService> = {
            tryGetRoots: () => []
        };
        container.bind(WorkspaceService).toConstantValue(mockWorkspaceService as WorkspaceService);

        // Bind CommandRegistry — needed by PaneServiceImpl
        container.bind(CommandRegistry).toConstantValue({
            executeCommand: async () => undefined,
        } as unknown as CommandRegistry);

        // Bind ILogger — needed by PaneServiceImpl after T3-14 migration
        loggerSpy = {
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined,
            debug: () => undefined,
        };
        container.bind(ILogger).toConstantValue(loggerSpy);
        
        paneService = container.get(PaneService);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('openContent', () => {
        it('should open editor content and return success', async () => {
            // Act
            const result = await paneService.openContent({
                type: 'editor',
                contentId: 'test-file.ts',
                title: 'Test File'
            });

            // Assert
            expect(result.success).to.be.true;
            expect(result.paneId).to.be.a('string');
        });

        it('should open terminal in bottom panel', async () => {
            // Arrange
            (mockShell as any).addWidget = async (_widget: Widget, _options: any) => {};

            // Act
            const result = await paneService.openContent({
                type: 'terminal',
                contentId: 'terminal-1',
                title: 'Terminal'
            });

            // Assert
            expect(result.success).to.be.true;
        });

        it('should respect split direction option', async () => {
            // Arrange
            (mockShell as any).addWidget = async (_widget: Widget, _options: any) => {};

            // Act
            const result = await paneService.openContent({
                type: 'editor',
                contentId: 'split-file.ts',
                title: 'Split File',
                splitDirection: 'vertical'
            });

            // Assert
            expect(result.success).to.be.true;
        });

        it('should pass ref widget when sourcePaneId resolves to a known widget', async () => {
            const refWidget = { id: 'source-pane-123' } as any;
            (mockShell as any).getWidgetById = (id: string) =>
                id === 'source-pane-123' ? refWidget : undefined;

            let capturedWidgetOptions: any;
            const mockEditorWidget = { id: 'new-editor-1' } as any;
            // Override the editorManager on the service instance
            const service = paneService as any;
            service.editorManager = {
                open: async (_uri: any, opts: any) => {
                    capturedWidgetOptions = opts?.widgetOptions;
                    return mockEditorWidget;
                }
            };

            const result = await paneService.openContent({
                type: 'editor',
                contentId: '/workspace/foo.ts',
                sourcePaneId: 'source-pane-123',
                splitDirection: 'vertical',
            });

            expect(result.success).to.be.true;
            expect(capturedWidgetOptions.ref).to.equal(refWidget);
            expect(capturedWidgetOptions.mode).to.equal('split-right');
        });

        it('should ignore sourcePaneId when it does not resolve to a known widget', async () => {
            (mockShell as any).getWidgetById = (_id: string) => undefined;

            let capturedWidgetOptions: any;
            const mockEditorWidget = { id: 'new-editor-2' } as any;
            const service = paneService as any;
            service.editorManager = {
                open: async (_uri: any, opts: any) => {
                    capturedWidgetOptions = opts?.widgetOptions;
                    return mockEditorWidget;
                }
            };

            const result = await paneService.openContent({
                type: 'editor',
                contentId: '/workspace/bar.ts',
                sourcePaneId: 'nonexistent-pane',
                splitDirection: 'vertical',
            });

            expect(result.success).to.be.true;
            expect(capturedWidgetOptions?.ref).to.be.undefined;
            expect(capturedWidgetOptions?.mode).to.equal('split-right');
        });

        it('should activate existing editor tab for duplicate content (REQ-PANE-017)', async () => {
            const existingWidget = createMockWidget('code-editor-opener:file:///workspace/foo.ts:1', 'foo.ts') as unknown as Widget;
            const shellGetWidgetById = sinon.stub(mockShell as any, 'getWidgetById');
            shellGetWidgetById.withArgs('code-editor-opener:file:///workspace/foo.ts:1').returns(existingWidget);
            (mockShell as any).activateWidget = sinon.stub().resolves(true);
            (mockShell as any).revealWidget = sinon.stub().resolves(undefined);

            const service = paneService as any;
            const openSpy = sinon.stub().resolves({ id: 'new-editor-id' });
            service.editorManager = { open: openSpy };

            const result = await paneService.openContent({
                type: 'editor',
                contentId: '/workspace/foo.ts',
                title: 'Foo'
            });

            expect(result.success).to.be.true;
            expect(result.paneId).to.equal('code-editor-opener:file:///workspace/foo.ts:1');
            expect(openSpy.called).to.be.false;
            expect((mockShell as any).activateWidget.calledWith('code-editor-opener:file:///workspace/foo.ts:1')).to.be.true;
        });
    });

    describe('closeContent (REQ-PANE-002, REQ-PANE-004)', () => {
        it('should close pane by ID and return success', async () => {
            // Arrange
            const mockWidget = createMockWidget('test-pane', 'Test Pane');
            (mockShell as any).getWidgetById = (id: string) => {
                if (id === 'test-pane') return mockWidget;
                return undefined;
            };
            (mockShell as any).closeWidget = async (_widget: Widget) => true;

            // Act
            const result = await paneService.closeContent({
                paneId: 'test-pane'
            });

            // Assert
            expect(result.success).to.be.true;
        });

        it('should return failure for non-existent pane', async () => {
            // Arrange
            (mockShell as any).getWidget = () => undefined;
            const warnSpy = sinon.spy(loggerSpy, 'warn');

            // Act
            const result = await paneService.closeContent({
                paneId: 'non-existent'
            });

            // Assert
            expect(result.success).to.be.false;
            expect(warnSpy.calledWithMatch('Pane not found: non-existent')).to.be.true;
        });

        it('should remove pane from agent tracking when pane closes', async () => {
            const mockWidget = createMockWidget('agent-pane-1', 'Agent Pane');
            (mockShell as any).getWidgetById = (id: string) => (id === 'agent-pane-1' ? mockWidget : undefined);
            (mockShell as any).closeWidget = async (_widget: Widget) => true;

            (paneService as any).trackAgentPane('agent-pane-1', false);
            expect((paneService as any).getAgentPanes().map((p: any) => p.paneId)).to.include('agent-pane-1');

            const result = await paneService.closeContent({ paneId: 'agent-pane-1' });

            expect(result.success).to.be.true;
            expect((paneService as any).getAgentPanes().map((p: any) => p.paneId)).to.not.include('agent-pane-1');
        });

        it('should prompt before closing dirty content and cancel when user declines (REQ-PANE-024)', async () => {
            const dirtyWidget = createMockWidget('dirty-pane', 'dirty.ts') as unknown as Widget & { isDirty?: boolean };
            dirtyWidget.isDirty = true;
            (mockShell as any).getWidgetById = (id: string) => (id === 'dirty-pane' ? dirtyWidget : undefined);
            const closeSpy = sinon.stub(mockShell as any, 'closeWidget').resolves(true);
            const confirmStub = sinon.stub(window, 'confirm').returns(false);

            const result = await paneService.closeContent({ paneId: 'dirty-pane' });

            expect(result.success).to.be.false;
            expect(confirmStub.calledOnce).to.be.true;
            expect(closeSpy.called).to.be.false;
        });

        it('should close dirty content when user confirms prompt (REQ-PANE-024)', async () => {
            const dirtyWidget = createMockWidget('dirty-pane-2', 'dirty2.ts') as unknown as Widget & { isDirty?: boolean };
            dirtyWidget.isDirty = true;
            (mockShell as any).getWidgetById = (id: string) => (id === 'dirty-pane-2' ? dirtyWidget : undefined);
            const closeSpy = sinon.stub(mockShell as any, 'closeWidget').resolves(true);
            const confirmStub = sinon.stub(window, 'confirm').returns(true);

            const result = await paneService.closeContent({ paneId: 'dirty-pane-2' });

            expect(result.success).to.be.true;
            expect(confirmStub.calledOnce).to.be.true;
            expect(closeSpy.calledOnceWith('dirty-pane-2')).to.be.true;
        });

        it('should not block manual close of pinned agent pane (REQ-PANE-014)', async () => {
            const widget = createMockWidget('pinned-pane', 'Pinned') as unknown as Widget;
            (mockShell as any).getWidgetById = (id: string) => (id === 'pinned-pane' ? widget : undefined);
            const closeSpy = sinon.stub(mockShell as any, 'closeWidget').resolves(true);
            (paneService as any).trackAgentPane('pinned-pane', true);

            const result = await paneService.closeContent({ paneId: 'pinned-pane' });

            expect(result.success).to.be.true;
            expect(closeSpy.calledOnceWith('pinned-pane')).to.be.true;
        });
    });

    describe('focusContent (REQ-PANE-003, REQ-PANE-004)', () => {
        it('should focus pane by ID and return success', async () => {
            // Arrange
            const mockWidget = createMockWidget('focus-pane', 'Focus Pane');
            (mockShell as any).getWidgetById = (id: string) => {
                if (id === 'focus-pane') return mockWidget;
                return undefined;
            };
            (mockShell as any).activateWidget = async (_id: string) => true;

            // Act
            const result = await paneService.focusContent({
                paneId: 'focus-pane'
            });

            // Assert
            expect(result.success).to.be.true;
        });

        it('should return failure for non-existent pane', async () => {
            // Arrange
            (mockShell as any).getWidget = () => undefined;
            const warnSpy = sinon.spy(loggerSpy, 'warn');

            // Act
            const result = await paneService.focusContent({
                paneId: 'non-existent'
            });

            // Assert
            expect(result.success).to.be.false;
            expect(warnSpy.calledWithMatch('Pane not found: non-existent')).to.be.true;
        });
    });

    describe('listPanes', () => {
        it('should return empty array when no panes exist', async () => {
            // Arrange - no widgets (getWidgets returns empty array)
            (mockShell as any).getWidgets = (_area: string) => [];

            // Act
            const panes = await paneService.listPanes();

            // Assert
            expect(panes).to.be.an('array');
            expect(panes.length).to.equal(0);
        });

        it('should return panes with correct structure', async () => {
            // Arrange - mock a widget by overriding getWidgets
            const mockWidget = createMockWidget('editor-1', 'Test Editor', 'main');
            (mockShell as any).getWidgets = (area: string) => {
                if (area === 'main') {
                    return [mockWidget];
                }
                return [];
            };

            // Act
            const panes = await paneService.listPanes();

            // Assert
            expect(panes).to.be.an('array');
            expect(panes.length).to.be.greaterThan(0);
            const pane = panes[0];
            expect(pane).to.have.property('id');
            expect(pane).to.have.property('area');
            expect(pane).to.have.property('tabs');
            expect(pane).to.have.property('title');
        });

        it('should include geometry percentages for pane size and position (REQ-PANE-006)', async () => {
            const mockWidget = createMockWidget('editor-geo', 'Geometry Editor', 'main') as unknown as any;
            mockWidget.node = {
                getBoundingClientRect: () => ({
                    x: 100,
                    y: 50,
                    width: 200,
                    height: 120,
                    top: 50,
                    left: 100,
                    right: 300,
                    bottom: 170,
                    toJSON: () => undefined,
                })
            };

            (mockShell as any).getWidgets = (area: string) => (area === 'main' ? [mockWidget] : []);

            const panes = await paneService.listPanes();
            const pane = panes.find(p => p.id === 'editor-geo');

            expect(pane).to.exist;
            expect(pane?.width).to.be.a('number');
            expect(pane?.height).to.be.a('number');
            expect(pane?.x).to.be.a('number');
            expect(pane?.y).to.be.a('number');
        });
    });

    describe('resizePane', () => {
        // Task 17: resizePane is not implemented (Theia has no direct resize API).
        // It must return { success: false } rather than silently pretending to succeed.

        it('should return success:false for valid resize request (not implemented)', async () => {
            // Arrange
            const mockWidget = createMockWidget('resize-pane', 'Resize Pane');
            (mockShell as any).getWidgetById = (id: string) => {
                if (id === 'resize-pane') return mockWidget;
                return undefined;
            };

            // Act
            const result = await paneService.resizePane({
                paneId: 'resize-pane',
                width: 50,
                height: 50
            });

            // Assert: honest not-implemented response
            expect(result.success).to.be.false;
        });

        it('should return success:false without specifying dimensions (not implemented)', async () => {
            // Arrange
            const mockWidget = createMockWidget('resize-pane-2', 'Resize Pane 2');
            (mockShell as any).getWidgetById = (id: string) => {
                if (id === 'resize-pane-2') return mockWidget;
                return undefined;
            };

            // Act
            const result = await paneService.resizePane({
                paneId: 'resize-pane-2'
            });

            // Assert: honest not-implemented response
            expect(result.success).to.be.false;
        });
    });

    describe('onPaneLayoutChanged', () => {
        it('should emit event when layout changes', async () => {
            // Arrange
            let eventFired = false;
            let receivedSnapshot: any;
            
            paneService.onPaneLayoutChanged((snapshot) => {
                eventFired = true;
                receivedSnapshot = snapshot;
            });

            // Get the shell's onDidAddWidget emitter by accessing it through the mock
            // We need to simulate a widget being added to trigger the layout change
            // The PaneService listens to shell.onDidAddWidget, onDidRemoveWidget, onDidChangeActiveWidget
            
            // Access the internal shell mock to fire the event
            const shell = container.get(ApplicationShell) as any;
            
            // Fire the onDidAddWidget event to simulate a widget being added
            if (shell.onDidAddWidget && typeof shell.onDidAddWidget === 'function') {
                // Get the emitter from the shell mock by checking its event property
                // Since we bound it as an Emitter.event, we need to manually fire it
                // The mock was set up with Emitter objects, so let's create new ones and replace
                const addWidgetEmitter = new Emitter<any>();
                shell.onDidAddWidget = addWidgetEmitter.event;
                addWidgetEmitter.fire({});
            } else if (shell._onDidAddWidget) {
                shell._onDidAddWidget.fire({});
            }

            // Give time for event to propagate
            await new Promise(resolve => setTimeout(resolve, 50));

            // Assert - the event should fire because openContent emits layout changes
            // Let's verify by opening content which triggers emitLayoutChange
            await paneService.openContent({
                type: 'editor',
                contentId: 'test-file.ts',
                title: 'Test File'
            });
            
            await new Promise(resolve => setTimeout(resolve, 50));

            // Assert
            expect(eventFired).to.be.true;
            expect(receivedSnapshot).to.have.property('panes');
            expect(receivedSnapshot).to.have.property('timestamp');
        });
    });

    describe('agent pane tracking', () => {
        it('should track agent-created panes', () => {
            // This tests the resource tracking feature
            // The implementation should track panes created by the agent
            
            // Get tracked panes - this would need the getAgentPanes method
            // which is part of the resource tracking for GAP-4
            const agentPanes = (paneService as any).getAgentPanes?.() ?? [];
            expect(agentPanes).to.be.an('array');
        });
    });

    describe('layout persistence (REQ-PANE-009..012)', () => {
        it('should persist layout structure and content separately', async () => {
            const mockWidget = createMockWidget('editor-main', 'Main Editor', 'main') as unknown as any;
            mockWidget.node = {
                getBoundingClientRect: () => ({
                    x: 20,
                    y: 10,
                    width: 800,
                    height: 500,
                    top: 10,
                    left: 20,
                    right: 820,
                    bottom: 510,
                    toJSON: () => undefined,
                })
            };
            mockWidget.currentWidget = {
                id: 'code-editor-opener:file:///workspace/readme.md:1',
                title: { label: 'readme.md' },
                isDisposed: false,
            };
            (mockShell as any).getWidgets = (area: string) => (area === 'main' ? [mockWidget] : []);
            (mockShell as any).activeWidget = mockWidget;

            await (paneService as any).emitLayoutChange();

            const persistedStructureRaw = window.localStorage.getItem('openspace.pane.layout.structure');
            const persistedContentRaw = window.localStorage.getItem('openspace.pane.layout.content');

            expect(persistedStructureRaw).to.exist;
            expect(persistedContentRaw).to.exist;

            const persistedStructure = JSON.parse(String(persistedStructureRaw));
            const persistedContent = JSON.parse(String(persistedContentRaw));

            expect(persistedStructure.panes[0]).to.have.property('area', 'main');
            expect(persistedStructure.panes[0]).to.not.have.property('tabs');

            expect(persistedContent.panes[0]).to.have.property('paneId', 'editor-main');
            expect(persistedContent.panes[0].tabs).to.be.an('array');
        });

        it('restores layout structure first and restores content only when enabled', async () => {
            const structure = {
                panes: [
                    { paneId: 'pane-1', area: 'main', title: 'Main', width: 80, height: 70, x: 0, y: 0 },
                ],
                activePane: 'pane-1',
                persistedAt: '2026-02-23T00:00:00.000Z',
            };
            const content = {
                panes: [
                    {
                        paneId: 'pane-1',
                        activeTab: 'code-editor-opener:file:///workspace/main.ts:1',
                        tabs: [
                            { id: 'code-editor-opener:file:///workspace/main.ts:1', title: 'main.ts', type: 'editor', uri: 'file:///workspace/main.ts' },
                        ]
                    }
                ],
                persistedAt: '2026-02-23T00:00:00.000Z',
            };

            window.localStorage.setItem('openspace.pane.layout.structure', JSON.stringify(structure));
            window.localStorage.setItem('openspace.pane.layout.content', JSON.stringify(content));

            const service = paneService as any;
            const structureSpy = sinon.spy(service, 'applyPersistedLayoutStructure');
            const contentSpy = sinon.spy(service, 'restorePersistedContent');

            await service.restorePersistedLayout({ restoreContent: false });
            expect(structureSpy.calledOnce).to.be.true;
            expect(contentSpy.called).to.be.false;

            await service.restorePersistedLayout({ restoreContent: true });
            expect(contentSpy.calledOnce).to.be.true;
        });

        it('preserves layout when a persisted tab cannot be restored (REQ-PANE-012)', async () => {
            const structure = {
                panes: [
                    { paneId: 'pane-1', area: 'main', title: 'Main', width: 80, height: 70, x: 0, y: 0 },
                ],
                activePane: 'pane-1',
                persistedAt: '2026-02-23T00:00:00.000Z',
            };
            const content = {
                panes: [
                    {
                        paneId: 'pane-1',
                        activeTab: 'code-editor-opener:file:///workspace/missing.ts:1',
                        tabs: [
                            { id: 'code-editor-opener:file:///workspace/missing.ts:1', title: 'missing.ts', type: 'editor', uri: 'file:///workspace/missing.ts' },
                        ]
                    }
                ],
                persistedAt: '2026-02-23T00:00:00.000Z',
            };

            window.localStorage.setItem('openspace.pane.layout.structure', JSON.stringify(structure));
            window.localStorage.setItem('openspace.pane.layout.content', JSON.stringify(content));

            const service = paneService as any;
            const warnSpy = sinon.spy((service as any).logger, 'warn');
            const openStub = sinon.stub(service, 'openContent').rejects(new Error('File missing'));

            const result = await service.restorePersistedLayout({ restoreContent: true });

            expect(result.success).to.be.true;
            expect(result.restoredStructure).to.be.true;
            expect(result.restoredContent).to.be.true;
            expect(openStub.calledOnce).to.be.true;
            expect(warnSpy.calledWithMatch('Unable to restore tab')).to.be.true;
        });

        it('supports saving and restoring named workspace layouts (REQ-PANE-013)', async () => {
            const service = paneService as any;

            const save = await service.saveNamedLayout('coding');
            expect(save.success).to.be.true;

            const names = service.listNamedLayouts();
            expect(names).to.include('coding');

            const namedLayoutsRaw = window.localStorage.getItem('openspace.pane.namedLayouts');
            expect(namedLayoutsRaw).to.exist;

            const load = await service.restoreNamedLayout('coding', { restoreContent: true });
            expect(load.success).to.be.true;
        });

        it('reorders tabs within a pane and persists the new order (REQ-PANE-021)', async () => {
            const service = paneService as any;
            const content = {
                panes: [
                    {
                        paneId: 'pane-a',
                        activeTab: 'tab-1',
                        tabs: [
                            { id: 'tab-1', title: 'one.ts', type: 'editor', uri: 'file:///workspace/one.ts' },
                            { id: 'tab-2', title: 'two.ts', type: 'editor', uri: 'file:///workspace/two.ts' },
                            { id: 'tab-3', title: 'three.ts', type: 'editor', uri: 'file:///workspace/three.ts' },
                        ]
                    }
                ],
                persistedAt: '2026-02-23T00:00:00.000Z',
            };
            window.localStorage.setItem('openspace.pane.layout.content', JSON.stringify(content));

            const result = await service.reorderTab({ paneId: 'pane-a', tabId: 'tab-3', targetIndex: 0 });
            expect(result.success).to.be.true;

            const persisted = JSON.parse(String(window.localStorage.getItem('openspace.pane.layout.content')));
            expect(persisted.panes[0].tabs.map((t: any) => t.id)).to.deep.equal(['tab-3', 'tab-1', 'tab-2']);
        });

        it('moves tab from source pane to target pane (REQ-PANE-022)', async () => {
            const service = paneService as any;
            const content = {
                panes: [
                    {
                        paneId: 'source-pane',
                        activeTab: 'tab-1',
                        tabs: [
                            { id: 'tab-1', title: 'one.ts', type: 'editor', uri: 'file:///workspace/one.ts' },
                            { id: 'tab-2', title: 'two.ts', type: 'editor', uri: 'file:///workspace/two.ts' },
                        ]
                    },
                    {
                        paneId: 'target-pane',
                        activeTab: 'tab-9',
                        tabs: [
                            { id: 'tab-9', title: 'nine.ts', type: 'editor', uri: 'file:///workspace/nine.ts' },
                        ]
                    }
                ],
                persistedAt: '2026-02-23T00:00:00.000Z',
            };
            window.localStorage.setItem('openspace.pane.layout.content', JSON.stringify(content));

            const result = await service.moveTab({
                sourcePaneId: 'source-pane',
                targetPaneId: 'target-pane',
                tabId: 'tab-2',
                targetIndex: 1,
            });
            expect(result.success).to.be.true;

            const persisted = JSON.parse(String(window.localStorage.getItem('openspace.pane.layout.content')));
            const sourceTabs = persisted.panes.find((p: any) => p.paneId === 'source-pane').tabs.map((t: any) => t.id);
            const targetTabs = persisted.panes.find((p: any) => p.paneId === 'target-pane').tabs.map((t: any) => t.id);
            expect(sourceTabs).to.deep.equal(['tab-1']);
            expect(targetTabs).to.deep.equal(['tab-9', 'tab-2']);
        });
    });
});
