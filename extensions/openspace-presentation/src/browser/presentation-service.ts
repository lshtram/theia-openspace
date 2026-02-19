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

import { inject, injectable } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { Disposable, Emitter } from '@theia/core/lib/common';
import { ILogger } from '@theia/core/lib/common/logger';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileStat } from '@theia/filesystem/lib/common/files';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { PresentationWidget, DeckData, DeckOptions } from './presentation-widget';

/**
 * File extension for presentation files.
 */
const DECK_EXTENSION = '.deck.md';

/**
 * Presentation service for managing deck files and playback state.
 * Provides CRUD operations for .deck.md files and tracks active presentation state.
 */
@injectable()
export class PresentationService {

    @inject(FileService)
    protected readonly fileService!: FileService;

    @inject(WorkspaceService)
    protected readonly workspaceService!: WorkspaceService;

    @inject(ILogger)
    protected readonly logger!: ILogger;

    /**
     * Get the file extension for presentation files.
     */
    getFileExtension(): string {
        return DECK_EXTENSION;
    }

    /**
     * List all .deck.md presentation files in the workspace.
     * @returns Array of absolute presentation file paths
     */
    async listPresentations(): Promise<string[]> {
        const roots = await this.workspaceService.roots;
        if (!roots.length) {
            this.logger.warn('[PresentationService] No workspace open');
            return [];
        }
        const results: string[] = [];
        for (const root of roots) {
            await this.collectDeckFiles(root.resource, results);
        }
        return results;
    }

    private async collectDeckFiles(dirUri: URI, results: string[]): Promise<void> {
        let stat: FileStat;
        try {
            stat = await this.fileService.resolve(dirUri);
        } catch {
            return; // not readable — skip
        }
        if (!stat.children) { return; }
        for (const child of stat.children) {
            const name = child.resource.path.base;
            if (child.isDirectory) {
                // Skip node_modules and hidden dirs
                if (name === 'node_modules' || name.startsWith('.')) { continue; }
                await this.collectDeckFiles(child.resource, results);
            } else if (name.endsWith(DECK_EXTENSION)) {
                results.push(child.resource.toString());
            }
        }
    }

    /**
     * Read a presentation file and return its content and metadata.
     * @param path The file path to read
     * @returns The deck content and parsed data
     */
    async readPresentation(path: string): Promise<{ content: string; data: DeckData }> {
        const uri = new URI(path);
        const contentResult = await this.fileService.read(uri);
        const content = contentResult.value;
        
        const data = PresentationWidget.parseDeckContent(content);
        
        return { content, data };
    }

    /**
     * Create a new presentation file.
     * @param path The file path for the new presentation
     * @param title The presentation title
     * @param slides Array of slide content strings
     * @param options Optional deck options (theme, transition)
     * @returns The created file path
     */
    async createPresentation(
        path: string,
        title: string,
        slides: string[] = ['# Slide 1\n\nWelcome to your presentation'],
        options?: DeckOptions
    ): Promise<string> {
        // Ensure path has correct extension
        let finalPath = path;
        if (!finalPath.endsWith(DECK_EXTENSION)) {
            finalPath = `${path}${DECK_EXTENSION}`;
        }

        const uri = new URI(finalPath);
        const content = this.buildDeckContent(title, slides, options);
        
        await this.fileService.create(uri, content);
        
        this.logger.info('[PresentationService] Created presentation:', finalPath);
        return finalPath;
    }

    /**
     * Build deck markdown content from title, slides, and options.
     */
    protected buildDeckContent(title: string, slides: string[], options?: DeckOptions): string {
        const frontmatter: string[] = [];
        frontmatter.push('---');
        frontmatter.push(`title: ${title}`);
        
        if (options?.theme) {
            frontmatter.push(`theme: ${options.theme}`);
        }
        if (options?.transition) {
            frontmatter.push(`transition: ${options.transition}`);
        }
        
        frontmatter.push('---');
        
        const content = slides.map(slide => 
            slide.includes('#') || slide.includes('\n') ? slide : `# ${slide}`
        ).join('\n\n---\n\n');
        
        return frontmatter.join('\n') + '\n\n' + content;
    }

    /**
     * Update a specific slide in a presentation.
     * @param path The file path
     * @param slideIndex The zero-based slide index
     * @param content The new slide content
     */
    async updateSlide(path: string, slideIndex: number, content: string): Promise<void> {
        const { data } = await this.readPresentation(path);
        
        if (slideIndex < 0 || slideIndex >= data.slides.length) {
            throw new Error(`Invalid slide index: ${slideIndex}. Available slides: ${data.slides.length}`);
        }
        
        // Update the slide content
        const newSlides = [...data.slides];
        newSlides[slideIndex] = { content, notes: newSlides[slideIndex].notes };
        
        // Rebuild the content
        const newContent = this.buildDeckContent(
            data.options.title || 'Untitled',
            newSlides.map(s => s.content),
            data.options
        );
        
        const uri = new URI(path);
        await this.fileService.write(uri, newContent);
        
        this.logger.info('[PresentationService] Updated slide', String(slideIndex), 'in', path);

        // Fire live-reload event directly — fileService.write() does not cause
        // onDidFilesChange to fire (that event is for external filesystem changes only).
        // Always fire the event; the listener in PresentationCommandContribution checks
        // widget.uri to filter to the correct widget.
        this.onDidChangeEmitter.fire({ path, content: newContent });
    }

    /**
     * Get the current playback state.
     */
    getPlaybackState(): PlaybackState {
        return this.playbackState;
    }

    /**
     * Set the playback state.
     */
    setPlaybackState(state: PlaybackState): void {
        this.playbackState = state;
    }

    /**
     * Current active presentation path.
     */
    protected activePresentationPath?: string;
    
    /**
     * Current playback state.
     */
    protected playbackState: PlaybackState = {
        isPlaying: false,
        isPaused: false,
        currentSlide: 0,
        totalSlides: 0
    };

    /**
     * Emitter for file change events on the active presentation.
     */
    private readonly onDidChangeEmitter = new Emitter<{ path: string; content: string }>();

    /**
     * Event fired when the active .deck.md file changes on disk.
     */
    readonly onDidChange = this.onDidChangeEmitter.event;

    /**
     * Disposable for the current file watch.
     */
    private watchDisposable: Disposable | undefined;

    /**
     * Set the active presentation path and start watching for file changes.
     */
    setActivePresentation(path: string | undefined): void {
        this.activePresentationPath = path;
        if (path) {
            this.startWatching(path);
        } else {
            this.watchDisposable?.dispose();
            this.watchDisposable = undefined;
        }
    }

    private startWatching(path: string): void {
        // Clean up previous watch
        this.watchDisposable?.dispose();

        const uri = new URI(path);
        const watchDisposable = this.fileService.watch(uri);
        const listener = this.fileService.onDidFilesChange(event => {
            const changed = event.changes.find(c =>
                c.resource.toString() === uri.toString()
            );
            if (!changed) { return; }
            this.reloadActiveWidget(path);
        });

        this.watchDisposable = Disposable.create(() => {
            watchDisposable.dispose();
            listener.dispose();
        });
    }

    private async reloadActiveWidget(path: string): Promise<void> {
        try {
            const { content } = await this.readPresentation(path);
            this.onDidChangeEmitter.fire({ path, content });
        } catch {
            // File deleted or unreadable — ignore
        }
    }

    /**
     * Get the active presentation path.
     */
    getActivePresentation(): string | undefined {
        return this.activePresentationPath;
    }
}

/**
 * Playback state for presentations.
 */
export interface PlaybackState {
    isPlaying: boolean;
    isPaused: boolean;
    currentSlide: number;
    totalSlides: number;
}

/**
 * Argument types for presentation commands.
 */
export type PresentationListArgs = Record<string, never>;

export interface PresentationReadArgs {
    path: string;
}

export interface PresentationCreateArgs {
    path: string;
    title: string;
    slides?: string[];
    theme?: string;
}

export interface PresentationUpdateSlideArgs {
    path: string;
    slideIndex: number;
    content: string;
}

export interface PresentationOpenArgs {
    path: string;
    slideIndex?: number;
    splitDirection?: 'right' | 'left' | 'bottom' | 'new-tab';
}

export interface PresentationNavigateArgs {
    direction?: 'prev' | 'next';
    slideIndex?: number;
}

export interface PresentationPlayArgs {
    path?: string;
    interval?: number;
}

export interface PresentationPauseArgs {
    path?: string;
}

export interface PresentationStopArgs {
    path?: string;
}
