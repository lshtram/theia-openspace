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
import { FileService } from '@theia/filesystem/lib/browser/file-service';
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

    /**
     * Get the file extension for presentation files.
     */
    getFileExtension(): string {
        return DECK_EXTENSION;
    }

    /**
     * List all presentation files in the workspace.
     * Returns the workspace root path - actual listing would be done via search.
     * @returns Array of presentation file paths
     */
    async listPresentations(): Promise<string[]> {
        const workspaceRoot = this.workspaceService.workspace;
        if (!workspaceRoot) {
            console.warn('[PresentationService] No workspace open');
            return [];
        }

        // Return the workspace root for search-based listing
        // The BridgeContribution handles search-based listing for commands
        return [workspaceRoot.resource.toString()];
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
        
        console.log('[PresentationService] Created presentation:', finalPath);
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
        
        console.log('[PresentationService] Updated slide', slideIndex, 'in', path);
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
     * Set the active presentation path.
     */
    setActivePresentation(path: string | undefined): void {
        this.activePresentationPath = path;
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
}

export interface PresentationNavigateArgs {
    direction?: 'prev' | 'next';
    slideIndex?: number;
}

export interface PresentationPlayArgs {
    path?: string;
}

export interface PresentationPauseArgs {
    path?: string;
}

export interface PresentationStopArgs {
    path?: string;
}
