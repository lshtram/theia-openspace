/* eslint-disable @typescript-eslint/no-explicit-any */
/********************************************************************************
 * Copyright (C) 2024 OpenSpace contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 ********************************************************************************/

import * as React from '@theia/core/shared/react';
import type { MessagePart, OpenCodeService, PermissionNotification } from 'openspace-core/lib/common/opencode-protocol';
import type { SessionService } from 'openspace-core/lib/browser/session-service/session-service';
import { renderMarkdown } from '../markdown-renderer';
import { renderToolPart } from './tool-call-renderer';

/**
 * Render a single message part based on its type.
 */
export function renderPart(
    part: MessagePart,
    index: number,
    openCodeService?: OpenCodeService,
    sessionService?: SessionService,
    pendingPermissions?: PermissionNotification[],
    onReplyPermission?: (requestId: string, reply: 'once' | 'always' | 'reject') => void,
    onOpenFile?: (filePath: string) => void
): React.ReactNode {
    switch (part.type) {
        case 'text':
            return renderTextPart(part, index, onOpenFile);
        case 'tool':
            return renderToolPart(part, index, openCodeService, sessionService, pendingPermissions, onReplyPermission, onOpenFile);
        case 'reasoning':
            return renderReasoningPart(part, index);
        case 'step-start':
        case 'step-finish':
            return null;
        case 'file':
            return renderFilePart(part, index);
        case 'agent':
            return renderAgentPart(part, index);
        case 'compaction':
            return renderCompactionPart(part, index);
        case 'patch':
            return renderPatchPart(part, index);
        case 'snapshot':
            return renderSnapshotPart(part, index);
        default:
            return renderFallbackPart(part, index);
    }
}

/**
 * Memoized text part component.
 *
 * During streaming the parent re-renders every second (elapsed-timer tick) even
 * when the text hasn't changed.  `renderMarkdown` is expensive (markdown-it
 * parse -> DOMPurify sanitize -> regex linkification), so we cache its output
 * with `React.useMemo` keyed on the actual text content.
 */
export const TextPart = React.memo(function TextPart({ part, index, onOpenFile }: {
    part: { text?: string }; index: number; onOpenFile?: (filePath: string) => void;
}) {
    const text: string = part.text || '';

    // Suppress pure JSON artifacts (empty array/object leaked from tool output streaming)
    if (!text || text.trim() === '[]' || text.trim() === '{}') return null;

    const rendered = React.useMemo(() => renderMarkdown(text, onOpenFile), [text, onOpenFile]);

    return (
        <div key={`text-${index}`} className="part-text">
            {rendered}
        </div>
    );
}, (prev, next) => prev.part.text === next.part.text && prev.index === next.index);

/** Helper to render a TextPart from the renderPart dispatcher. */
export function renderTextPart(part: any, index: number, onOpenFile?: (filePath: string) => void): React.ReactNode {
    return <TextPart key={`text-${index}`} part={part} index={index} onOpenFile={onOpenFile} />;
}

/** Reasoning block — renders reasoning text inline with markdown, no sub-header or nested toggle. */
const ReasoningBlock: React.FC<{ part: any }> = React.memo(({ part }) => {
    const text: string = part.text || part.reasoning || '';
    if (!text) return null;
    const rendered = React.useMemo(() => renderMarkdown(text), [text]);
    return (
        <div className="part-reasoning-inline part-text">
            {rendered}
        </div>
    );
});

function renderReasoningPart(part: any, index: number): React.ReactNode {
    return <ReasoningBlock key={`reasoning-${index}`} part={part} />;
}

/** Render file part — pill with file icon. */
function renderFilePart(part: any, index: number): React.ReactNode {
    const filePath: string = part.filename || part.file || part.url || 'unknown';
    return (
        <div key={`file-${index}`} className="part-file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11" aria-hidden="true">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                <polyline points="14 2 14 8 20 8"/>
            </svg>
            <span>{filePath}</span>
        </div>
    );
}

/** Render agent part — shows sub-agent invocation with name. */
function renderAgentPart(part: any, index: number): React.ReactNode {
    const name: string = part.name ?? 'sub-agent';
    return (
        <div key={`agent-${index}`} className="part-agent">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                <rect width="10" height="10" x="7" y="7" rx="1"/>
                <path d="M9 2h6"/><path d="M12 2v5"/>
                <path d="M9 22h6"/><path d="M12 22v-5"/>
                <path d="M2 9v6"/><path d="M2 12h5"/>
                <path d="M22 9v6"/><path d="M22 12h-5"/>
            </svg>
            <span className="part-agent-name">{name}</span>
        </div>
    );
}

/** Render compaction part — visual divider indicating context was compacted. */
function renderCompactionPart(part: any, index: number): React.ReactNode {
    const isAuto: boolean = part.auto === true;
    return (
        <div key={`compaction-${index}`} className="compaction-marker">
            <div className="compaction-line" />
            <span className="compaction-label">{isAuto ? 'Context auto-compacted' : 'Context compacted'}</span>
            <div className="compaction-line" />
        </div>
    );
}

/** Render patch part — shows list of changed files. */
function renderPatchPart(part: any, index: number): React.ReactNode {
    const files: string[] = Array.isArray(part.files) ? part.files : [];
    return (
        <div key={`patch-${index}`} className="part-patch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
            <span className="part-patch-label">{files.length > 0 ? files.join(', ') : 'file changed'}</span>
        </div>
    );
}

/** Render snapshot part — shows a snapshot marker. */
function renderSnapshotPart(part: any, index: number): React.ReactNode {
    const snapshotId: string = typeof part.snapshot === 'string' ? part.snapshot.slice(0, 7) : '';
    return (
        <div key={`snapshot-${index}`} className="part-snapshot">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
            </svg>
            <span className="part-snapshot-label">Snapshot{snapshotId ? ` (${snapshotId})` : ''}</span>
        </div>
    );
}

/** Render fallback for unhandled part types. */
function renderFallbackPart(part: MessagePart, index: number): React.ReactNode {
    return (
        <span key={`other-${index}`} className="part-fallback">
            {part.type}
        </span>
    );
}
