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

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser/keybinding';
import { ApplicationShell, WidgetManager } from '@theia/core/lib/browser';
import { PresentationService, 
    PresentationListArgs, 
    PresentationReadArgs, 
    PresentationCreateArgs,
    PresentationUpdateSlideArgs,
    PresentationOpenArgs,
    PresentationNavigateArgs,
    PresentationPlayArgs,
    PresentationPauseArgs,
    PresentationStopArgs
} from './presentation-service';
import { PresentationWidget, PresentationNavigationService } from './presentation-widget';

/**
 * Command IDs for presentation commands.
 * These are used for manifest generation (argument schemas stored in command-manifest.ts).
 */
export const PresentationCommandIds = {
    LIST: 'openspace.presentation.list',
    READ: 'openspace.presentation.read',
    CREATE: 'openspace.presentation.create',
    UPDATE_SLIDE: 'openspace.presentation.update_slide',
    OPEN: 'openspace.presentation.open',
    NAVIGATE: 'openspace.presentation.navigate',
    PLAY: 'openspace.presentation.play',
    PAUSE: 'openspace.presentation.pause',
    STOP: 'openspace.presentation.stop',
    TOGGLE_FULLSCREEN: 'openspace.presentation.toggleFullscreen',
} as const;

/**
 * Argument schemas for presentation commands.
 * Used for manifest auto-generation in Phase 3.
 */
export const PresentationArgumentSchemas = {
    list: {
        type: 'object',
        properties: {},
        additionalProperties: false
    },
    read: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the presentation file'
            }
        },
        required: ['path'],
        additionalProperties: false
    },
    create: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path for the new presentation file'
            },
            title: {
                type: 'string',
                description: 'Title of the presentation'
            },
            slides: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of slide contents'
            },
            theme: {
                type: 'string',
                description: 'Presentation theme (black, white, league, beige, sky, night, etc.)'
            }
        },
        required: ['path', 'title'],
        additionalProperties: false
    },
    update_slide: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the presentation file'
            },
            slideIndex: {
                type: 'number',
                description: 'Zero-based slide index to update'
            },
            content: {
                type: 'string',
                description: 'New slide content (markdown)'
            }
        },
        required: ['path', 'slideIndex', 'content'],
        additionalProperties: false
    },
    open: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Path to the presentation file'
            },
            splitDirection: {
                type: 'string',
                enum: ['right', 'left', 'bottom', 'new-tab'],
                description: 'Where to open the presentation widget (default: right)'
            }
        },
        required: ['path'],
        additionalProperties: false
    },
    navigate: {
        type: 'object',
        properties: {
            direction: {
                type: 'string',
                enum: ['prev', 'next'],
                description: 'Navigation direction'
            },
            slideIndex: {
                type: 'number',
                description: 'Specific slide index to navigate to (0-based)'
            }
        },
        additionalProperties: false
    },
    play: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Optional path to presentation file'
            },
            interval: {
                type: 'number',
                description: 'Autoplay interval in milliseconds (default: 5000)'
            }
        },
        additionalProperties: false
    },
    pause: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Optional path to presentation file'
            }
        },
        additionalProperties: false
    },
    stop: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Optional path to presentation file'
            }
        },
        additionalProperties: false
    },
    TOGGLE_FULLSCREEN: {
        type: 'object',
        properties: {},
        additionalProperties: false
    },
};

/**
 * Command contribution for presentation commands.
 * Registers all openspace.presentation.* commands in Theia's CommandRegistry.
 */
@injectable()
export class PresentationCommandContribution implements CommandContribution, KeybindingContribution {

    @inject(PresentationService)
    protected readonly presentationService!: PresentationService;

    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;

    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;

    @inject(PresentationNavigationService)
    protected readonly navigationService!: PresentationNavigationService;

    private autoplayTimer: ReturnType<typeof setInterval> | undefined;

    @postConstruct()
    protected init(): void {
        // Clean up autoplay timer when the presentation widget is destroyed
        this.widgetManager.onDidCreateWidget(({ factoryId, widget }) => {
            if (factoryId === PresentationWidget.ID) {
                (widget as PresentationWidget).onDidDispose(() => {
                    if (this.autoplayTimer !== undefined) {
                        clearInterval(this.autoplayTimer);
                        this.autoplayTimer = undefined;
                    }
                });
            }
        });

        // Live reload: when the active .deck.md changes on disk, push new content to widget
        this.presentationService.onDidChange(({ path, content }) => {
            const widget = this.widgetManager.tryGetWidget<PresentationWidget>(PresentationWidget.ID);
            if (widget && widget.uri === path) {
                widget.setContent(content);
            }
        });
    }

    /**
     * Register all presentation commands.
     */
    registerCommands(registry: CommandRegistry): void {
        // openspace.presentation.list
        registry.registerCommand(
            { 
                id: PresentationCommandIds.LIST,
                label: 'OpenSpace: List Presentations'
            },
            {
                execute: async (args?: PresentationListArgs) => {
                    console.log('[PresentationCommand] Listing presentations');
                    return this.presentationService.listPresentations();
                }
            }
        );

        // openspace.presentation.read
        registry.registerCommand(
            { 
                id: PresentationCommandIds.READ,
                label: 'OpenSpace: Read Presentation'
            },
            {
                execute: async (args: PresentationReadArgs) => {
                    console.log('[PresentationCommand] Reading presentation:', args.path);
                    return this.presentationService.readPresentation(args.path);
                }
            }
        );

        // openspace.presentation.create
        registry.registerCommand(
            { 
                id: PresentationCommandIds.CREATE,
                label: 'OpenSpace: Create Presentation'
            },
            {
                execute: async (args: PresentationCreateArgs) => {
                    console.log('[PresentationCommand] Creating presentation:', args.path);
                    return this.presentationService.createPresentation(
                        args.path,
                        args.title,
                        args.slides,
                        args.theme ? { theme: args.theme } : undefined
                    );
                }
            }
        );

        // openspace.presentation.update_slide
        registry.registerCommand(
            { 
                id: PresentationCommandIds.UPDATE_SLIDE,
                label: 'OpenSpace: Update Slide'
            },
            {
                execute: async (args: PresentationUpdateSlideArgs) => {
                    console.log('[PresentationCommand] Updating slide:', args.slideIndex, 'in', args.path);
                    return this.presentationService.updateSlide(args.path, args.slideIndex, args.content);
                }
            }
        );

        // openspace.presentation.open
        registry.registerCommand(
            { 
                id: PresentationCommandIds.OPEN,
                label: 'OpenSpace: Open Presentation'
            },
            {
                execute: async (args: PresentationOpenArgs) => {
                    console.log('[PresentationCommand] Opening presentation:', args.path);
                    return this.openPresentation(args);
                }
            }
        );

        // openspace.presentation.navigate
        registry.registerCommand(
            { 
                id: PresentationCommandIds.NAVIGATE,
                label: 'OpenSpace: Navigate Presentation'
            },
            {
                execute: async (args: PresentationNavigateArgs) => {
                    console.log('[PresentationCommand] Navigating presentation:', args);
                    return this.navigatePresentation(args);
                }
            }
        );

        // openspace.presentation.play
        registry.registerCommand(
            { 
                id: PresentationCommandIds.PLAY,
                label: 'OpenSpace: Play Presentation'
            },
            {
                execute: async (args?: PresentationPlayArgs) => {
                    console.log('[PresentationCommand] Playing presentation');
                    return this.playPresentation(args ?? {});
                }
            }
        );

        // openspace.presentation.pause
        registry.registerCommand(
            { 
                id: PresentationCommandIds.PAUSE,
                label: 'OpenSpace: Pause Presentation'
            },
            {
                execute: async (args?: PresentationPauseArgs) => {
                    console.log('[PresentationCommand] Pausing presentation');
                    return this.pausePresentation();
                }
            }
        );

        // openspace.presentation.stop
        registry.registerCommand(
            { 
                id: PresentationCommandIds.STOP,
                label: 'OpenSpace: Stop Presentation'
            },
            {
                execute: async (args?: PresentationStopArgs) => {
                    console.log('[PresentationCommand] Stopping presentation');
                    return this.stopPresentation();
                }
            }
        );

        // openspace.presentation.toggleFullscreen
        registry.registerCommand(
            { id: PresentationCommandIds.TOGGLE_FULLSCREEN, label: 'Presentation: Toggle Fullscreen' },
            { execute: () => this.toggleFullscreen() }
        );
    }

    /**
     * Register keybindings for presentation commands.
     */
    registerKeybindings(registry: KeybindingRegistry): void {
        registry.registerKeybinding({
            command: PresentationCommandIds.TOGGLE_FULLSCREEN,
        keybinding: 'ctrlcmd+shift+alt+f',
        });
    }

    /**
     * Open a presentation in a widget.
     */
    protected async openPresentation(args: PresentationOpenArgs): Promise<void> {
        const { path, splitDirection } = args;

        // Use service (not raw fileService.read) to avoid duplicate read logic
        const { content, data } = await this.presentationService.readPresentation(path);

        const widget = await this.widgetManager.getOrCreateWidget<PresentationWidget>(
            PresentationWidget.ID,
            { uri: path }
        );

        // Map splitDirection to Theia shell area/mode
        const area: ApplicationShell.Area = splitDirection === 'bottom' ? 'bottom' : 'main';
        const mode: ApplicationShell.WidgetOptions['mode'] =
            splitDirection === 'left'    ? 'split-left'  :
            splitDirection === 'bottom'  ? 'tab-after'   :
            splitDirection === 'new-tab' ? 'tab-after'   :
            'split-right'; // default

        await this.shell.addWidget(widget, { area, mode });

        widget.setContent(content);
        await this.shell.activateWidget(widget.id);

        this.presentationService.setActivePresentation(path);
        this.presentationService.setPlaybackState({
            isPlaying: false,
            isPaused: false,
            currentSlide: 0,
            totalSlides: data.slides.length,
        });
    }

    /**
     * Navigate the presentation.
     */
    protected async navigatePresentation(args: PresentationNavigateArgs): Promise<void> {
        const state = this.presentationService.getPlaybackState();
        
        if (args.slideIndex !== undefined) {
            // Navigate to specific slide
            this.navigationService.slide(args.slideIndex);
            this.presentationService.setPlaybackState({
                ...state,
                currentSlide: args.slideIndex
            });
        } else if (args.direction) {
            // Navigate by direction
            if (args.direction === 'next') {
                this.navigationService.next();
            } else if (args.direction === 'prev') {
                this.navigationService.prev();
            }
        }
    }

    /**
     * Start presentation playback.
     */
    protected playPresentation(args: PresentationPlayArgs): void {
        const interval = args.interval ?? 5000;
        if (this.autoplayTimer !== undefined) {
            clearInterval(this.autoplayTimer);
        }
        this.autoplayTimer = setInterval(() => {
            this.navigationService.next();
        }, interval);
        this.presentationService.setPlaybackState({
            ...this.presentationService.getPlaybackState(),
            isPlaying: true,
            isPaused: false,
        });
    }

    /**
     * Pause presentation playback.
     */
    protected pausePresentation(): void {
        if (this.autoplayTimer !== undefined) {
            clearInterval(this.autoplayTimer);
            this.autoplayTimer = undefined;
        }
        this.presentationService.setPlaybackState({
            ...this.presentationService.getPlaybackState(),
            isPlaying: false,
            isPaused: true,
        });
    }

    /**
     * Stop presentation and exit.
     */
    protected stopPresentation(): void {
        if (this.autoplayTimer !== undefined) {
            clearInterval(this.autoplayTimer);
            this.autoplayTimer = undefined;
        }
        this.navigationService.slide(0, 0);
        this.presentationService.setPlaybackState({
            isPlaying: false,
            isPaused: false,
            currentSlide: 0,
            totalSlides: this.presentationService.getPlaybackState().totalSlides,
        });
    }

    /**
     * Toggle fullscreen mode for the presentation widget.
     */
    protected toggleFullscreen(): void {
        const widget = this.widgetManager.tryGetWidget<PresentationWidget>(PresentationWidget.ID);
        const container = widget?.revealContainer;
        if (!container) { return; }
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container.requestFullscreen();
        }
    }
}
