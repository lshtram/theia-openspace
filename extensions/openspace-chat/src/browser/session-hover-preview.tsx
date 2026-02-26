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

import * as React from '@theia/core/shared/react';
import type { SessionService } from 'openspace-core/lib/browser/session-service';
import { Message } from 'openspace-core/lib/common/opencode-protocol';

interface SessionHoverPreviewProps {
    sessionId: string;
    sessionService: SessionService;
    /** Position in px relative to the viewport */
    anchorRect: DOMRect;
}

/** Extract plain text from a message's parts. */
function extractText(msg: Message): string {
    if (!msg.parts) { return ''; }
    for (const part of msg.parts) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = part as any;
        if (p.type === 'text' && typeof p.text === 'string') {
            return p.text.slice(0, 120) + (p.text.length > 120 ? '…' : '');
        }
    }
    return '';
}

/**
 * Floating popover showing the last few messages of a session.
 * Rendered via a portal into document.body to escape overflow:hidden containers.
 */
export const SessionHoverPreview: React.FC<SessionHoverPreviewProps> = ({
    sessionId,
    sessionService,
    anchorRect,
}) => {
    const [messages, setMessages] = React.useState<Message[] | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        let cancelled = false;
        setLoading(true);
        sessionService.getMessagesForPreview(sessionId).then(msgs => {
            if (!cancelled) {
                setMessages(msgs);
                setLoading(false);
            }
        }).catch(() => {
            if (!cancelled) {
                setMessages([]);
                setLoading(false);
            }
        });
        return () => { cancelled = true; };
    }, [sessionId, sessionService]);

    // Position: prefer right side of anchor, fallback to left
    const style: React.CSSProperties = {
        position: 'fixed',
        top: anchorRect.top,
        left: anchorRect.right + 8,
        zIndex: 9999,
    };

    const userMessages = messages ? messages.filter(m => m.role === 'user') : [];

    return (
        <div className="session-hover-preview" style={style} role="tooltip" aria-live="polite">
            {loading ? (
                <div className="session-hover-preview-loading">Loading…</div>
            ) : userMessages.length === 0 ? (
                <div className="session-hover-preview-empty">No messages yet</div>
            ) : (
                <ul className="session-hover-preview-list">
                    {userMessages.map(msg => {
                        const text = extractText(msg);
                        return text ? (
                            <li key={msg.id} className="session-hover-preview-item">
                                {text}
                            </li>
                        ) : null;
                    })}
                </ul>
            )}
        </div>
    );
};
