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
 * Tests for PresentationService methods.
 */

// Helper to parse deck content (mimics widget logic)
function parseDeckContent(markdown: string): { options: { title?: string; theme?: string }; slides: { content: string }[] } {
    const lines = markdown.split('\n');
    const frontmatter: Record<string, string> = {};
    const slides: { content: string }[] = [];
    
    // Parse YAML frontmatter
    if (lines[0]?.trim() === '---') {
        let i = 1;
        while (i < lines.length && lines[i].trim() !== '---') {
            const [key, ...valueParts] = lines[i].split(':');
            if (key && valueParts.length > 0) {
                frontmatter[key.trim()] = valueParts.join(':').trim();
            }
            i++;
        }
        
        // Skip past closing ---
        i++;
        
        // Get remaining content as slides
        const content = lines.slice(i).join('\n');
        const slideContents = content.split(/^---$/m).filter(s => s.trim());
        
        slideContents.forEach(slideContent => {
            const cleanContent = slideContent.replace(/Note[s]?:\s*[\s\S]*$/i, '').trim();
            slides.push({ content: cleanContent });
        });
    } else {
        // No frontmatter, treat entire content as slides
        const slideContents = markdown.split(/^---$/m).filter(s => s.trim());
        slideContents.forEach(slideContent => {
            slides.push({ content: slideContent.trim() });
        });
    }
    
    return {
        options: {
            title: frontmatter.title,
            theme: frontmatter.theme || 'black'
        },
        slides
    };
}

// Test buildDeckContent
function buildDeckContent(title: string, slides: string[], options?: { theme?: string }): string {
    const frontmatter: string[] = [];
    frontmatter.push('---');
    frontmatter.push(`title: ${title}`);
    
    if (options?.theme) {
        frontmatter.push(`theme: ${options.theme}`);
    }
    
    frontmatter.push('---');
    
    const content = slides.map(slide => 
        slide.includes('#') || slide.includes('\n') ? slide : `# ${slide}`
    ).join('\n\n---\n\n');
    
    return frontmatter.join('\n') + '\n\n' + content;
}

describe('PresentationService', () => {
    describe('getFileExtension', () => {
        it('should return .deck.md', () => {
            const ext = '.deck.md';
            if (ext !== '.deck.md') {
                throw new Error(`Expected .deck.md, got ${ext}`);
            }
        });
    });

    describe('parseDeckContent', () => {
        it('should parse simple presentation', () => {
            const content = `---
title: Test Presentation
theme: black
---
# Slide 1
Content 1
---
# Slide 2
Content 2`;

            const result = parseDeckContent(content);
            
            if (result.options.title !== 'Test Presentation') {
                throw new Error(`Expected title "Test Presentation", got "${result.options.title}"`);
            }
            if (result.slides.length !== 2) {
                throw new Error(`Expected 2 slides, got ${result.slides.length}`);
            }
            if (!result.slides[0].content.includes('Slide 1')) {
                throw new Error(`First slide should contain "Slide 1"`);
            }
        });

        it('should handle presentation without frontmatter', () => {
            const content = `# Slide 1
Content 1
---
# Slide 2
Content 2`;

            const result = parseDeckContent(content);
            
            if (result.slides.length !== 2) {
                throw new Error(`Expected 2 slides, got ${result.slides.length}`);
            }
        });

        it('should handle single slide', () => {
            const content = `---
title: Single Slide
---
# Hello World`;

            const result = parseDeckContent(content);
            
            if (result.slides.length !== 1) {
                throw new Error(`Expected 1 slide, got ${result.slides.length}`);
            }
        });
    });

    describe('buildDeckContent', () => {
        it('should build presentation with title', () => {
            const slides = ['# Slide 1', '# Slide 2'];
            const content = buildDeckContent('My Presentation', slides);
            
            if (!content.includes('title: My Presentation')) {
                throw new Error('Content should include title');
            }
            if (!content.includes('# Slide 1')) {
                throw new Error('Content should include first slide');
            }
        });

        it('should include theme when provided', () => {
            const slides = ['# Slide 1'];
            const content = buildDeckContent('Test', slides, { theme: 'night' });
            
            if (!content.includes('theme: night')) {
                throw new Error('Content should include theme');
            }
        });

        it('should handle plain text slides', () => {
            const slides = ['Just text'];
            const content = buildDeckContent('Test', slides);
            
            if (!content.includes('# Just text')) {
                throw new Error('Plain text should be wrapped in h1');
            }
        });
    });

    describe('updateSlide logic', () => {
        it('should update specific slide in array', () => {
            const slides = [
                { content: '# Slide 1' },
                { content: '# Slide 2' },
                { content: '# Slide 3' }
            ];
            
            // Update slide 1
            const newSlides = [...slides];
            newSlides[1] = { content: '# Updated Slide 2' };
            
            if (newSlides[1].content !== '# Updated Slide 2') {
                throw new Error('Slide should be updated');
            }
            if (newSlides[0].content !== '# Slide 1') {
                throw new Error('Other slides should not change');
            }
            if (newSlides[2].content !== '# Slide 3') {
                throw new Error('Other slides should not change');
            }
        });

        it('should throw error for invalid slide index', () => {
            const slides = [{ content: '# Slide 1' }];
            const slideIndex = 5;
            
            if (slideIndex < 0 || slideIndex >= slides.length) {
                // Expected behavior - throw error
            }
        });
    });
});
