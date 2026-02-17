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
 * THROWAWAY SPIKE: Presentation Widget Proof-of-Concept
 * 
 * This file is a temporary spike to validate reveal.js integration.
 * It will be replaced by the real implementation in Phase 4.1.
 * 
 * Date: 2026-02-17
 * Purpose: Validate reveal.js renders inside Theia ReactWidget
 */

import * as React from '@theia/core/shared/react';
import { injectable, postConstruct } from '@theia/core/shared/inversify';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import Reveal from 'reveal.js';
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/black.css';

/**
 * Presentation Widget - Proof of Concept
 * Tests reveal.js integration with Theia ReactWidget
 */
@injectable()
export class PresentationWidget extends ReactWidget {
    static readonly ID = 'openspace-presentation-widget';
    static readonly LABEL = 'Presentation';

    protected revealDeck: Reveal | undefined;
    protected deckInitialized = false;

    constructor() {
        super();
        this.id = PresentationWidget.ID;
        this.title.label = PresentationWidget.LABEL;
        this.title.caption = PresentationWidget.LABEL;
        this.title.closable = true;
        this.title.iconClass = 'fa fa-play-circle';
        this.addClass('openspace-presentation-widget');
    }

    @postConstruct()
    protected init(): void {
        this.update();
    }

    /**
     * Initialize reveal.js after the widget is attached to DOM
     */
    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.initializeReveal();
    }

    /**
     * Clean up reveal.js instance before detaching
     */
    protected onBeforeDetach(msg: Message): void {
        if (this.revealDeck) {
            this.revealDeck.destroy();
            this.revealDeck = undefined;
            this.deckInitialized = false;
        }
        super.onBeforeDetach(msg);
    }

    /**
     * Initialize reveal.js deck
     */
    protected initializeReveal(): void {
        if (this.deckInitialized) {
            console.log('[PresentationWidget] Reveal already initialized');
            return;
        }

        const deckElement = document.querySelector('.reveal') as HTMLElement;
        if (!deckElement) {
            console.warn('[PresentationWidget] Deck element not found');
            return;
        }

        try {
            this.revealDeck = new Reveal(deckElement, {
                hash: true,
                slideNumber: true,
                transition: 'slide',
                backgroundTransition: 'slide',
                // Disable keyboard to avoid conflict with Theia
                keyboard: false,
            });
            
            this.revealDeck.initialize().then(() => {
                console.log('[PresentationWidget] Reveal.js initialized successfully');
                this.deckInitialized = true;
            }).catch((err: Error) => {
                console.error('[PresentationWidget] Failed to initialize Reveal:', err);
            });
        } catch (err) {
            console.error('[PresentationWidget] Error creating Reveal instance:', err);
        }
    }

    protected render(): React.ReactNode {
        return (
            <div className="presentation-container">
                <div className="reveal">
                    <div className="slides">
                        <section>
                            <h1>OpenSpace Presentation</h1>
                            <p>reveal.js integration test</p>
                            <p><small>Press arrow keys to navigate (if keyboard works)</small></p>
                        </section>
                        <section>
                            <h2>Slide 2</h2>
                            <p>This is a test slide to verify reveal.js renders</p>
                        </section>
                        <section>
                            <h2>Slide 3</h2>
                            <ul>
                                <li>Test item 1</li>
                                <li>Test item 2</li>
                                <li>Test item 3</li>
                            </ul>
                        </section>
                        <section>
                            <h2>End</h2>
                            <p>End of presentation test</p>
                        </section>
                    </div>
                </div>
            </div>
        );
    }
}
