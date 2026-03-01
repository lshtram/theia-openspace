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

import * as fs from 'fs';
import * as nodePath from 'path';
import { z } from 'zod';
import { TOOL } from '../../common/tool-names';
import type { IMcpServer, BridgeDeps, HubLogger } from './types';

/** Extended deps for presentation tools — needs filesystem access for Slidev format. */
export interface PresentationDeps extends BridgeDeps {
    workspaceRoot: string;
    logger: HubLogger;
}

// ── Slidev command IDs (must match SlidevCommandIds in openspace-slidev) ──

const SLIDEV_CMD = {
    OPEN: 'openspace.slidev.open',
    NAVIGATE: 'openspace.slidev.navigate',
    PLAY: 'openspace.slidev.play',
    PAUSE: 'openspace.slidev.pause',
    STOP: 'openspace.slidev.stop',
    TOGGLE_FULLSCREEN: 'openspace.slidev.toggleFullscreen',
} as const;

// ── Format detection ──

function isSlidevFormat(filePath: string): boolean {
    return filePath.endsWith('.slides.md');
}

function isDeckFormat(filePath: string): boolean {
    return filePath.endsWith('.deck.md');
}

/** Track the active presentation format so stateless commands (navigate, play, etc.) route correctly. */
let activeFormat: 'slidev' | 'deck' | undefined;

// ── Slidev file helpers ──

function collectSlidesFiles(dir: string, results: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const name = entry.name;
        if (entry.isDirectory()) {
            if (name === 'node_modules' || name.startsWith('.')) { continue; }
            collectSlidesFiles(nodePath.join(dir, name), results);
        } else if (name.endsWith('.slides.md')) {
            results.push(nodePath.join(dir, name));
        }
    }
}

/** Parse a .slides.md file into slide data (Slidev frontmatter + --- delimited). */
function parseSlidevContent(content: string): { title: string; slides: Array<{ index: number; content: string; layout?: string }> } {
    const slides: Array<{ index: number; content: string; layout?: string }> = [];
    // Split on horizontal rules (--- on its own line, not inside frontmatter)
    const parts = content.split(/\n---\n/);
    let title = 'Untitled';

    for (let i = 0; i < parts.length; i++) {
        const raw = parts[i].trim();
        if (!raw) { continue; }

        // Extract frontmatter from this slide
        let slideContent = raw;
        let layout: string | undefined;

        // Check if slide starts with frontmatter (first slide may have global frontmatter)
        const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
        if (fmMatch) {
            const fmBlock = fmMatch[1];
            slideContent = fmMatch[2];
            // Extract layout from frontmatter
            const layoutMatch = fmBlock.match(/^layout:\s*(.+)$/m);
            if (layoutMatch) { layout = layoutMatch[1].trim(); }
            // Extract title from global frontmatter (first slide)
            if (i === 0) {
                const titleMatch = fmBlock.match(/^title:\s*(.+)$/m);
                if (titleMatch) { title = titleMatch[1].trim().replace(/^["']|["']$/g, ''); }
            }
        } else if (i === 0) {
            // First part might be frontmatter-only (starts with ---)
            const globalFm = raw.match(/^---\s*\n([\s\S]*?)$/);
            if (globalFm) {
                const fmBlock = globalFm[1];
                const titleMatch = fmBlock.match(/^title:\s*(.+)$/m);
                if (titleMatch) { title = titleMatch[1].trim().replace(/^["']|["']$/g, ''); }
                const layoutMatch = fmBlock.match(/^layout:\s*(.+)$/m);
                if (layoutMatch) { layout = layoutMatch[1].trim(); }
                slideContent = '';
            }
        }

        slides.push({ index: slides.length, content: slideContent, layout });
    }

    return { title, slides };
}

/** Build Slidev markdown from title and slide content array. */
function buildSlidevMarkdown(title: string, slides?: string[], palette?: string): string {
    const parts: string[] = [];

    // Global frontmatter
    const fmLines = [
        '---',
        `title: "${title}"`,
        'theme: openspace',
    ];
    if (palette) { fmLines.push(`palette: ${palette}`); }
    fmLines.push('---');
    parts.push(fmLines.join('\n'));

    // Title slide
    parts.push([
        '---',
        'layout: title',
        '---',
        '',
        `# ${title}`,
    ].join('\n'));

    // Additional slides
    if (slides?.length) {
        for (const slide of slides) {
            parts.push(slide);
        }
    }

    return parts.join('\n\n---\n\n');
}

// ── Tool registration ──

export function registerPresentationTools(server: IMcpServer, deps: PresentationDeps): void {

    // ── LIST ──
    server.tool(
        TOOL.PRESENTATION_LIST,
        'List all presentation files (.deck.md and .slides.md) in the workspace',
        {},
        async (args: unknown) => {
            // Get legacy .deck.md files via bridge
            const legacyResult = await deps.executeViaBridge(TOOL.PRESENTATION_LIST, args);

            // Collect .slides.md files from filesystem
            const slidevFiles: string[] = [];
            collectSlidesFiles(deps.workspaceRoot, slidevFiles);

            // Merge results — legacy result is a bridge response, extract paths
            // Bridge returns { content: [{ type: 'text', text: JSON }] }
            let legacyPaths: string[] = [];
            try {
                const resp = legacyResult as { content?: Array<{ text?: string }> };
                if (resp?.content?.[0]?.text) {
                    legacyPaths = JSON.parse(resp.content[0].text);
                }
            } catch {
                // If parsing fails, just return Slidev files
                deps.logger.warn('[PresentationTools] Failed to parse legacy list response');
            }

            const allFiles = [...legacyPaths, ...slidevFiles];
            return {
                content: [{ type: 'text', text: JSON.stringify(allFiles) }],
            };
        }
    );

    // ── READ ──
    server.tool(
        TOOL.PRESENTATION_READ,
        'Read a presentation file and return its parsed structure',
        {
            path: z.string().describe('Absolute path to the presentation file (.deck.md or .slides.md)'),
        },
        async (args: unknown) => {
            const { path: filePath } = args as { path: string };
            if (!filePath) {
                return { content: [{ type: 'text', text: 'Error: Missing required argument: path' }], isError: true };
            }

            if (isSlidevFormat(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const parsed = parseSlidevContent(content);
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                format: 'slidev',
                                path: filePath,
                                title: parsed.title,
                                slideCount: parsed.slides.length,
                                slides: parsed.slides,
                                raw: content,
                            }),
                        }],
                    };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Error reading file: ${String(err)}` }], isError: true };
                }
            }

            // Legacy .deck.md — delegate to bridge
            return deps.executeViaBridge(TOOL.PRESENTATION_READ, args);
        }
    );

    // ── CREATE ──
    server.tool(
        TOOL.PRESENTATION_CREATE,
        'Create a new presentation file. Use .slides.md extension for Slidev format (recommended) or .deck.md for legacy reveal.js',
        {
            path: z.string().describe('Path for the new presentation file (use .slides.md for Slidev, .deck.md for legacy)'),
            title: z.string().describe('Presentation title'),
            slides: z.array(z.string()).optional().describe('Array of markdown slide content strings'),
            palette: z.string().optional().describe('Color palette for Slidev: midnight-tech, ocean, slate-pro, light-pro'),
        },
        async (args: unknown) => {
            const { path: filePath, title, slides, palette } = args as {
                path: string; title: string; slides?: string[]; palette?: string;
            };
            if (!filePath) {
                return { content: [{ type: 'text', text: 'Error: Missing required argument: path' }], isError: true };
            }

            if (isSlidevFormat(filePath)) {
                try {
                    const markdown = buildSlidevMarkdown(title, slides, palette);
                    // Ensure directory exists
                    const dir = nodePath.dirname(filePath);
                    fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(filePath, markdown, 'utf-8');
                    deps.logger.info(`[PresentationTools] Created Slidev presentation: ${filePath}`);
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({ format: 'slidev', path: filePath, slideCount: (slides?.length ?? 0) + 1 }),
                        }],
                    };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Error creating file: ${String(err)}` }], isError: true };
                }
            }

            // Legacy .deck.md — delegate to bridge
            return deps.executeViaBridge(TOOL.PRESENTATION_CREATE, args);
        }
    );

    // ── UPDATE_SLIDE ──
    server.tool(
        TOOL.PRESENTATION_UPDATE_SLIDE,
        'Update the content of a single slide in a presentation file',
        {
            path: z.string().describe('Absolute path to the presentation file'),
            slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
            content: z.string().describe('New markdown content for the slide'),
        },
        async (args: unknown) => {
            const { path: filePath, slideIndex, content: newContent } = args as {
                path: string; slideIndex: number; content: string;
            };
            if (!filePath) {
                return { content: [{ type: 'text', text: 'Error: Missing required argument: path' }], isError: true };
            }

            if (isSlidevFormat(filePath)) {
                try {
                    const fileContent = fs.readFileSync(filePath, 'utf-8');
                    const parts = fileContent.split(/\n---\n/);

                    if (slideIndex < 0 || slideIndex >= parts.length) {
                        return {
                            content: [{ type: 'text', text: `Error: slideIndex ${slideIndex} out of range (0-${parts.length - 1})` }],
                            isError: true,
                        };
                    }

                    parts[slideIndex] = newContent;
                    const updated = parts.join('\n---\n');
                    fs.writeFileSync(filePath, updated, 'utf-8');

                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({ format: 'slidev', path: filePath, updatedSlide: slideIndex }),
                        }],
                    };
                } catch (err) {
                    return { content: [{ type: 'text', text: `Error updating slide: ${String(err)}` }], isError: true };
                }
            }

            // Legacy .deck.md — delegate to bridge
            return deps.executeViaBridge(TOOL.PRESENTATION_UPDATE_SLIDE, args);
        }
    );

    // ── OPEN ──
    server.tool(
        TOOL.PRESENTATION_OPEN,
        'Open a presentation file in the viewer pane. Supports .slides.md (Slidev) and .deck.md (legacy)',
        {
            path: z.string().describe('Absolute path to the presentation file'),
            splitDirection: z.enum(['right', 'left', 'bottom', 'new-tab']).optional()
                .describe('Where to open the pane (default: right)'),
        },
        async (args: unknown) => {
            const { path: filePath } = args as { path: string };

            if (isSlidevFormat(filePath)) {
                activeFormat = 'slidev';
                return deps.executeViaBridge(SLIDEV_CMD.OPEN, args);
            }

            activeFormat = 'deck';
            return deps.executeViaBridge(TOOL.PRESENTATION_OPEN, args);
        }
    );

    // ── NAVIGATE ──
    server.tool(
        TOOL.PRESENTATION_NAVIGATE,
        'Navigate to a slide in the active presentation',
        {
            direction: z.enum(['next', 'prev', 'first', 'last']).optional()
                .describe('Navigation direction'),
            slideIndex: z.number().int().min(0).optional()
                .describe('Absolute zero-based slide index to jump to'),
        },
        async (args: unknown) => {
            if (activeFormat === 'slidev') {
                return deps.executeViaBridge(SLIDEV_CMD.NAVIGATE, args);
            }
            return deps.executeViaBridge(TOOL.PRESENTATION_NAVIGATE, args);
        }
    );

    // ── PLAY ──
    server.tool(
        TOOL.PRESENTATION_PLAY,
        'Start autoplay — advances slides automatically on a timer',
        {
            interval: z.number().int().min(500).optional()
                .describe('Milliseconds between slides (default: 5000)'),
        },
        async (args: unknown) => {
            if (activeFormat === 'slidev') {
                return deps.executeViaBridge(SLIDEV_CMD.PLAY, args);
            }
            return deps.executeViaBridge(TOOL.PRESENTATION_PLAY, args);
        }
    );

    // ── PAUSE ──
    server.tool(
        TOOL.PRESENTATION_PAUSE,
        'Pause autoplay, keeping current slide position',
        {},
        async (args: unknown) => {
            if (activeFormat === 'slidev') {
                return deps.executeViaBridge(SLIDEV_CMD.PAUSE, args);
            }
            return deps.executeViaBridge(TOOL.PRESENTATION_PAUSE, args);
        }
    );

    // ── STOP ──
    server.tool(
        TOOL.PRESENTATION_STOP,
        'Stop autoplay and return to the first slide',
        {},
        async (args: unknown) => {
            if (activeFormat === 'slidev') {
                return deps.executeViaBridge(SLIDEV_CMD.STOP, args);
            }
            return deps.executeViaBridge(TOOL.PRESENTATION_STOP, args);
        }
    );

    // ── TOGGLE FULLSCREEN ──
    server.tool(
        TOOL.PRESENTATION_TOGGLE_FULLSCREEN,
        'Toggle fullscreen mode for the active presentation viewer',
        {},
        async (args: unknown) => {
            if (activeFormat === 'slidev') {
                return deps.executeViaBridge(SLIDEV_CMD.TOGGLE_FULLSCREEN, args);
            }
            return deps.executeViaBridge(TOOL.PRESENTATION_TOGGLE_FULLSCREEN, args);
        }
    );
}
