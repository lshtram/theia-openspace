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

/** Retry banner — shows error message, countdown, and attempt number. */
export const RetryBanner: React.FC<{ retryInfo: { message: string; attempt: number; next: number } }> = ({ retryInfo }) => {
    const [secondsLeft, setSecondsLeft] = React.useState(() =>
        Math.max(0, Math.round((retryInfo.next - Date.now()) / 1000))
    );

    React.useEffect(() => {
        const update = () => {
            setSecondsLeft(Math.max(0, Math.round((retryInfo.next - Date.now()) / 1000)));
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [retryInfo.next]);

    const msg = retryInfo.message.length > 60
        ? retryInfo.message.slice(0, 60) + '...'
        : retryInfo.message;

    return (
        <div className="part-retry-banner">
            <span className="part-retry-message">{msg}</span>
            <span className="part-retry-countdown">
                · Retrying{secondsLeft > 0 ? ` in ${secondsLeft}s` : ''}
            </span>
            <span className="part-retry-attempt">(#{retryInfo.attempt})</span>
        </div>
    );
};

/** Copy response button with clipboard animation. */
export const CopyButton: React.FC<{
    parts: Array<{ type: string; text?: string }>;
    isUser: boolean;
    isStreaming: boolean;
}> = ({ parts, isUser, isStreaming }) => {
    const [copied, setCopied] = React.useState(false);
    const showCopyBtn = !isUser && !isStreaming && parts.some(p => p.type === 'text');

    const lastTextPart = React.useMemo(() => {
        const textParts = parts.filter(p => p.type === 'text');
        return textParts.length > 0 ? textParts[textParts.length - 1] : null;
    }, [parts]);

    const handleCopy = React.useCallback(() => {
        if (!lastTextPart) return;
        navigator.clipboard.writeText(lastTextPart.text || '').then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [lastTextPart]);

    if (!showCopyBtn) return null;

    return (
        <button
            type="button"
            className={copied ? 'copy-response-btn copy-response-btn--copied' : 'copy-response-btn'}
            onClick={handleCopy}
            aria-label={copied ? 'Copied!' : 'Copy response'}
            title={copied ? 'Copied!' : 'Copy response'}
        >
            {copied ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="2" width="6" height="4" rx="1"/>
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                </svg>
            )}
        </button>
    );
};

/** Cost bar — displays token usage and cost. */
export const CostBar: React.FC<{ costBarData: { input: number; output: number; cost: number } }> = ({ costBarData }) => (
    <div className="turn-cost-bar">
        <span className="turn-cost-tokens">{costBarData.input}↑ {costBarData.output}↓</span>
        <span className="turn-cost-price">${costBarData.cost.toFixed(4)}</span>
    </div>
);
