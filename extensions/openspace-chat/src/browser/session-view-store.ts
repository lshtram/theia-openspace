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

import { injectable } from '@theia/core/shared/inversify';

/**
 * Symbol for DI binding.
 */
export const SessionViewStore = Symbol('SessionViewStore');

/**
 * Per-session UI state that we persist across session switches.
 */
export interface SessionViewState {
    /** Scroll position (pixels from top). */
    scrollTop: number;
    /** ID of the last visible message when this session was viewed. */
    lastMessageId?: string;
}

/**
 * LRU cache (up to MAX_ENTRIES) that maps sessionId → SessionViewState.
 * Used by MessageTimeline to restore scroll position when switching sessions.
 */
export interface SessionViewStore {
    get(sessionId: string): SessionViewState | undefined;
    set(sessionId: string, state: SessionViewState): void;
}

const MAX_ENTRIES = 50;

@injectable()
export class SessionViewStoreImpl implements SessionViewStore {
    /** Ordered map — insertion order = LRU order. */
    private readonly _map = new Map<string, SessionViewState>();

    get(sessionId: string): SessionViewState | undefined {
        return this._map.get(sessionId);
    }

    set(sessionId: string, state: SessionViewState): void {
        // Remove then re-insert to update LRU order
        this._map.delete(sessionId);
        this._map.set(sessionId, state);
        // Evict oldest entry if over the limit
        if (this._map.size > MAX_ENTRIES) {
            const firstKey = this._map.keys().next().value;
            if (firstKey !== undefined) {
                this._map.delete(firstKey);
            }
        }
    }
}
