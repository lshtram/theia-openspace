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
import { PermissionDialogManager } from './permission-dialog-manager';

/**
 * Props for PermissionDialog component.
 */
export interface PermissionDialogProps {
    manager: PermissionDialogManager;
}

/**
 * PermissionDialog React component.
 * 
 * Displays a modal dialog when AI agents request permission for operations.
 * User can grant or deny permissions via buttons or keyboard shortcuts.
 * 
 * Features:
 * - Modal overlay with centered dialog
 * - Focus trap: Enter/Escape only work when dialog has focus
 * - Grant (Enter) / Deny (Escape) keyboard shortcuts (when focused)
 * - Queue indicator for multiple requests
 * - Action details formatting
 * - Theia dark theme styling
 */
export const PermissionDialog: React.FC<PermissionDialogProps> = ({ manager }) => {
    const [isOpen, setIsOpen] = React.useState(manager.isOpen);
    const [currentRequest, setCurrentRequest] = React.useState(manager.currentRequest);
    const [queueLength, setQueueLength] = React.useState(manager.queueLength);
    const dialogRef = React.useRef<HTMLDivElement>(null);
    const [hasFocus, setHasFocus] = React.useState(false);

    // Subscribe to manager state changes
    React.useEffect(() => {
        const listener = () => {
            setIsOpen(manager.isOpen);
            setCurrentRequest(manager.currentRequest);
            setQueueLength(manager.queueLength);
        };

        const subscription = manager.onStateChange(listener);
        return () => subscription.dispose();
    }, [manager]);

    // Focus the dialog when it opens and track focus state
    React.useEffect(() => {
        if (isOpen && dialogRef.current) {
            // Focus the dialog when it appears
            dialogRef.current.focus();
            setHasFocus(true);
        } else {
            setHasFocus(false);
        }
    }, [isOpen]);

    // Track focus state for focus trap
    React.useEffect(() => {
        if (!isOpen || !dialogRef.current) {
            return;
        }

        const handleFocusIn = (event: FocusEvent) => {
            if (dialogRef.current?.contains(event.target as Node)) {
                setHasFocus(true);
            } else {
                setHasFocus(false);
            }
        };

        document.addEventListener('focusin', handleFocusIn);
        return () => document.removeEventListener('focusin', handleFocusIn);
    }, [isOpen]);

    // Keyboard event handlers - only work when dialog has focus (T2-18 focus trap)
    React.useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            // T2-18: Only handle Enter/Escape when dialog has focus
            // This prevents accidental permission grants when user is typing elsewhere
            if (!hasFocus) {
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                manager.grant();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                manager.deny();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, manager, hasFocus]);

    // T2-18: Full focus trap — cycle Tab key within dialog's focusable elements
    React.useEffect(() => {
        if (!isOpen || !dialogRef.current) {
            return;
        }

        const handleTabKey = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') {
                return;
            }
            if (!dialogRef.current) {
                return;  // guard against stale closure after unmount
            }

            const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
                'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            const elements = Array.from(focusableElements);
            if (elements.length === 0) {
                return;
            }

            const first = elements[0];
            const last = elements[elements.length - 1];
            const active = document.activeElement as HTMLElement;

            const idx = elements.indexOf(active);
            if (idx === -1) {
                // focus is outside the dialog — pull it back
                event.preventDefault();
                (event.shiftKey ? last : first).focus();
                return;
            }

            if (event.shiftKey) {
                // Shift+Tab: wrap from first to last
                if (active === first) {
                    event.preventDefault();
                    last.focus();
                }
            } else {
                // Tab: wrap from last to first
                if (active === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleTabKey);
        return () => document.removeEventListener('keydown', handleTabKey);
    }, [isOpen]);

    if (!isOpen || !currentRequest) {
        return null; // Dialog closed
    }

    const handleGrant = () => {
        manager.grant();
    };

    const handleDeny = () => {
        manager.deny();
    };

    // Format action type for display
    const formatActionType = (type: string): string => {
        const typeMap: Record<string, string> = {
            'file_write': 'Write File',
            'file_read': 'Read File',
            'file_delete': 'Delete File',
            'command_execute': 'Execute Command',
            'terminal_access': 'Terminal Access',
            'network_request': 'Network Request'
        };
        return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    // Extract agent ID from permission message (if present)
    const extractAgentId = (message: string): string | null => {
        const match = message.match(/Agent\s+(\w+)/i);
        return match ? match[1] : null;
    };

    const agentId = currentRequest.permission?.message ? extractAgentId(currentRequest.permission.message) : null;
    const actionType = currentRequest.permission?.type || 'Unknown Action';
    const actionMessage = currentRequest.permission?.message || 'No details available';
    const position = manager.currentPosition;
    const total = manager.totalRequests;

    return (
        <div className="openspace-permission-dialog-overlay">
            <div 
                className={`openspace-permission-dialog ${hasFocus ? 'has-focus' : ''}`}
                role="dialog" 
                aria-labelledby="permission-dialog-title" 
                aria-modal="true"
                ref={dialogRef}
                tabIndex={-1}
                onFocus={() => setHasFocus(true)}
                onBlur={() => setHasFocus(false)}
            >
                <div className="openspace-permission-header">
                    <h2 id="permission-dialog-title">Permission Required</h2>
                </div>
                
                <div className="openspace-permission-content">
                    {agentId && (
                        <div className="openspace-permission-agent">
                            <span className="label">Agent:</span> <span className="value">{agentId}</span>
                        </div>
                    )}
                    
                    <div className="openspace-permission-action-type">
                        <span className="label">Action:</span> <span className="value">{formatActionType(actionType)}</span>
                    </div>
                    
                    <div className="openspace-permission-details">
                        <span className="label">Details:</span>
                        <div className="openspace-permission-message">{actionMessage}</div>
                    </div>
                </div>
                
                <div className="openspace-permission-actions">
                    <button
                        className="permission-action-btn deny"
                        onClick={handleDeny}
                        type="button"
                        aria-label="Deny permission"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                        Deny
                    </button>
                    <button
                        className="permission-action-btn grant"
                        onClick={handleGrant}
                        type="button"
                        aria-label="Grant permission"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5"/>
                        </svg>
                        Grant
                    </button>
                </div>
                
                {queueLength > 0 && (
                    <div className="openspace-permission-queue-indicator">
                        Request {position} of {total}
                    </div>
                )}
            </div>
        </div>
    );
};
