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
import { Emitter, Event } from '@theia/core/lib/common/event';

/**
 * Symbol for DI binding.
 */
export const SessionNotificationService = Symbol('SessionNotificationService');

/**
 * Tracks per-session unseen message counts.
 * "Unseen" means messages that arrived while this session was not the active session.
 *
 * State is persisted to localStorage so it survives page refreshes.
 */
export interface SessionNotificationService {
    getUnseenCount(sessionId: string): number;
    markSeen(sessionId: string): void;
    incrementUnseen(sessionId: string): void;
    /** Fired whenever any unseen count changes. */
    readonly onUnseenChanged: Event<void>;
}

const STORAGE_KEY = 'openspace.unseenCounts';

@injectable()
export class SessionNotificationServiceImpl implements SessionNotificationService {
    private _counts = new Map<string, number>();
    private readonly _onUnseenChangedEmitter = new Emitter<void>();
    readonly onUnseenChanged = this._onUnseenChangedEmitter.event;

    constructor() {
        this._load();
    }

    getUnseenCount(sessionId: string): number {
        return this._counts.get(sessionId) ?? 0;
    }

    markSeen(sessionId: string): void {
        if (this._counts.get(sessionId) !== 0) {
            this._counts.set(sessionId, 0);
            this._save();
            this._onUnseenChangedEmitter.fire();
        }
    }

    incrementUnseen(sessionId: string): void {
        const current = this._counts.get(sessionId) ?? 0;
        this._counts.set(sessionId, current + 1);
        this._save();
        this._onUnseenChangedEmitter.fire();
    }

    private _load(): void {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Record<string, number>;
                for (const [k, v] of Object.entries(parsed)) {
                    if (typeof v === 'number') {
                        this._counts.set(k, v);
                    }
                }
            }
        } catch {
            // Corrupt storage — start fresh
        }
    }

    private _save(): void {
        try {
            const obj: Record<string, number> = {};
            this._counts.forEach((v, k) => { obj[k] = v; });
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
        } catch {
            // Storage quota exceeded — ignore
        }
    }
}
