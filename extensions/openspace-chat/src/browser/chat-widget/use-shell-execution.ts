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
import { OpenCodeService, Message } from 'openspace-core/lib/common/opencode-protocol';

/**
 * A locally-executed shell command result displayed inline in the chat timeline.
 * These are NOT persisted to the server — they live only in the client session.
 */
export interface ShellOutput {
    id: string;
    command: string;
    stdout: string;
    stderr: string;
    exitCode: number;
    error?: string;
    timestamp: number;
    /** Index into the messages array after which this output should appear */
    afterMessageIndex: number;
}

export interface ShellExecutionState {
    shellOutputs: ShellOutput[];
    handleShellCommand: (command: string) => Promise<void>;
}

/**
 * Shell command execution via `!` shell mode.
 * Takes a ref to the current messages array to compute `afterMessageIndex`.
 */
export function useShellExecution(
    openCodeService: OpenCodeService,
    workspaceRoot: string,
    messagesRef: React.MutableRefObject<Message[]>,
): ShellExecutionState {
    const [shellOutputs, setShellOutputs] = React.useState<ShellOutput[]>([]);

    const handleShellCommand = React.useCallback(async (command: string) => {
        if (!workspaceRoot) {
            const id = `shell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            setShellOutputs(prev => [...prev, {
                id, command, stdout: '', stderr: 'Cannot execute shell command: no workspace root is set.',
                exitCode: 1, timestamp: Date.now(), afterMessageIndex: messagesRef.current.length - 1,
            }]);
            return;
        }
        const cwd = workspaceRoot;
        const id = `shell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const placeholderEntry: ShellOutput = {
            id,
            command,
            stdout: '',
            stderr: '',
            exitCode: -1,
            timestamp: Date.now(),
            afterMessageIndex: messagesRef.current.length - 1,
        };
        setShellOutputs(prev => [...prev, placeholderEntry]);

        try {
            const result = await openCodeService.executeShellCommand(command, cwd);
            setShellOutputs(prev => prev.map(entry =>
                entry.id === id
                    ? { ...entry, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, error: result.error }
                    : entry
            ));
        } catch (err) {
            setShellOutputs(prev => prev.map(entry =>
                entry.id === id
                    ? { ...entry, stderr: err instanceof Error ? err.message : String(err), exitCode: 1, error: 'RPC error' }
                    : entry
            ));
        }
    }, [openCodeService, workspaceRoot]);

    return { shellOutputs, handleShellCommand };
}
