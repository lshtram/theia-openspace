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

import { injectable, inject, optional, postConstruct } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { ILogger } from '@theia/core/lib/common/logger';
import { Disposable } from '@theia/core/lib/common/disposable';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalWidget, TerminalWidgetOptions } from '@theia/terminal/lib/browser/base/terminal-widget';
import { TerminalRingBuffer, sanitizeOutput, isDangerous } from './terminal-ring-buffer';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import * as path from './browser-path';
import { OpenCodeService } from '../common/opencode-protocol';

/**
 * Allowlist of permitted shell executables.
 * Only shells in this list can be used for terminal creation.
 * Note: User's default shell is added dynamically at runtime.
 */
const ALLOWED_SHELLS = [
    '/bin/bash',
    '/bin/zsh',
    '/bin/sh',
    '/usr/bin/bash',
    '/usr/bin/zsh',
    '/usr/bin/sh'
].filter((shell): shell is string => typeof shell === 'string' && shell.length > 0);

/**
 * Get the allowed shells including the user's default shell.
 * This is called at runtime when a terminal is created, not at module load time.
 */
function getAllowedShells(): string[] {
    // Only include user's shell if available and not already in list
    let userShell: string | undefined;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        userShell = typeof process !== 'undefined' ? (process as any).env?.SHELL : undefined;
    } catch {
        // process not available in browser
    }
    
    const shells = [...ALLOWED_SHELLS];
    if (userShell && !shells.includes(userShell)) {
        shells.push(userShell);
    }
    return shells;
}

/**
 * Arguments for openspace.terminal.create command.
 */
export interface TerminalCreateArgs {
    title?: string;
    cwd?: string;
    shellPath?: string;
}

/**
 * Arguments for openspace.terminal.send command.
 */
export interface TerminalSendArgs {
    terminalId: string;
    text: string;
}

/**
 * Arguments for openspace.terminal.read_output command.
 */
export interface TerminalReadOutputArgs {
    terminalId: string;
    lines?: number;
}

/**
 * Arguments for openspace.terminal.close command.
 */
export interface TerminalCloseArgs {
    terminalId: string;
}

/**
 * Terminal info for list command response.
 */
export interface TerminalInfo {
    id: string;
    title: string;
    isActive: boolean;
}

/**
 * JSON Schema for openspace.terminal.create command arguments.
 */
export const TERMINAL_CREATE_SCHEMA = {
    type: 'object',
    properties: {
        title: {
            type: 'string',
            description: 'Terminal title'
        },
        cwd: {
            type: 'string',
            description: 'Working directory for the terminal'
        },
        shellPath: {
            type: 'string',
            description: 'Path to shell executable'
        }
    }
};

/**
 * JSON Schema for openspace.terminal.send command arguments.
 */
export const TERMINAL_SEND_SCHEMA = {
    type: 'object',
    properties: {
        terminalId: {
            type: 'string',
            description: 'ID of the terminal to send text to'
        },
        text: {
            type: 'string',
            description: 'Text to send to the terminal'
        }
    },
    required: ['terminalId', 'text']
};

/**
 * JSON Schema for openspace.terminal.read_output command arguments.
 */
export const TERMINAL_READ_OUTPUT_SCHEMA = {
    type: 'object',
    properties: {
        terminalId: {
            type: 'string',
            description: 'ID of the terminal to read output from'
        },
        lines: {
            type: 'number',
            description: 'Number of lines to read (default: 100)'
        }
    },
    required: ['terminalId']
};

/**
 * JSON Schema for openspace.terminal.close command arguments.
 */
export const TERMINAL_CLOSE_SCHEMA = {
    type: 'object',
    properties: {
        terminalId: {
            type: 'string',
            description: 'ID of the terminal to close'
        }
    },
    required: ['terminalId']
};

/**
 * Command IDs for terminal operations.
 */
export const TerminalCommands = {
    CREATE: 'openspace.terminal.create',
    SEND: 'openspace.terminal.send',
    READ_OUTPUT: 'openspace.terminal.read_output',
    LIST: 'openspace.terminal.list',
    CLOSE: 'openspace.terminal.close'
} as const;

/**
 * TerminalCommandContribution - Registers terminal commands in Theia's CommandRegistry.
 * 
 * Implements CommandContribution to register 5 terminal commands:
 * - openspace.terminal.create: Create a new terminal
 * - openspace.terminal.send: Send text to a terminal
 * - openspace.terminal.read_output: Read terminal output
 * - openspace.terminal.list: List all terminals
 * - openspace.terminal.close: Close a terminal
 * 
 * Security per §17.3 (dangerous commands) and §17.9 (output sanitization).
 * 
 * T1-1: Dangerous commands are BLOCKED (not just detected)
 * T1-2: shellPath and cwd are validated against allowlists
 */
@injectable()
export class TerminalCommandContribution implements CommandContribution {

    @inject(TerminalService)
    private readonly terminalService!: TerminalService;

    @inject(WorkspaceService)
    private readonly workspaceService!: WorkspaceService;

    @inject(OpenCodeService) @optional()
    private readonly openCodeService?: OpenCodeService;

    @inject(ILogger)
    protected readonly logger!: ILogger;

    private readonly ringBuffer: TerminalRingBuffer;

    /**
     * Map of terminal IDs to their widgets for tracking.
     */
    private terminalWidgets: Map<string, TerminalWidget> = new Map();
    
    // T2-16: Track onData listeners per terminal to prevent duplicates
    private terminalListeners: Map<string, Disposable> = new Map();

    constructor() {
        this.ringBuffer = new TerminalRingBuffer(10000);
    }

    @postConstruct()
    protected init(): void {
        // Listen for terminal creation events
        this.terminalService.onDidCreateTerminal((widget: TerminalWidget) => {
            this.trackTerminal(widget);
        });

        // Track existing terminals
        for (const widget of this.terminalService.all) {
            this.trackTerminal(widget);
        }
    }

    /**
     * Track a terminal widget.
     * T2-16: Prevents duplicate onData listeners
     */
    private trackTerminal(widget: TerminalWidget): void {
        this.terminalWidgets.set(widget.id, widget);
        
        // T2-16: Dispose existing listener if any (prevent duplicates)
        this.terminalListeners.get(widget.id)?.dispose();
        
        // Listen for output to capture in ring buffer
        const listener = widget.onData((data: string) => {
            this.ringBuffer.append(widget.id, data);
        });
        
        this.terminalListeners.set(widget.id, listener);
        
        // Listen for terminal dispose/close
        widget.onDidDispose(() => {
            this.untrackTerminal(widget.id);
        });
    }

    /**
     * Untrack a terminal by ID.
     * T2-16: Clean up listener on dispose
     */
    private untrackTerminal(terminalId: string): void {
        this.terminalWidgets.delete(terminalId);
        this.terminalListeners.get(terminalId)?.dispose();
        this.terminalListeners.delete(terminalId);
        this.ringBuffer.clear(terminalId);
    }

    /**
     * Register all terminal commands with Theia's CommandRegistry.
     */
    registerCommands(registry: CommandRegistry): void {
        // Register openspace.terminal.create
        registry.registerCommand(
            {
                id: TerminalCommands.CREATE,
                label: 'OpenSpace: Create Terminal'
            },
            {
                execute: async (args: TerminalCreateArgs) => {
                    return this.createTerminal(args);
                }
            }
        );

        // Register openspace.terminal.send
        registry.registerCommand(
            {
                id: TerminalCommands.SEND,
                label: 'OpenSpace: Send to Terminal'
            },
            {
                execute: async (args: TerminalSendArgs) => {
                    return this.sendToTerminal(args);
                }
            }
        );

        // Register openspace.terminal.read_output
        registry.registerCommand(
            {
                id: TerminalCommands.READ_OUTPUT,
                label: 'OpenSpace: Read Terminal Output'
            },
            {
                execute: async (args: TerminalReadOutputArgs) => {
                    return this.readTerminalOutput(args);
                }
            }
        );

        // Register openspace.terminal.list
        registry.registerCommand(
            {
                id: TerminalCommands.LIST,
                label: 'OpenSpace: List Terminals'
            },
            {
                execute: async () => {
                    return this.listTerminals();
                }
            }
        );

        // Register openspace.terminal.close
        registry.registerCommand(
            {
                id: TerminalCommands.CLOSE,
                label: 'OpenSpace: Close Terminal'
            },
            {
                execute: async (args: TerminalCloseArgs) => {
                    return this.closeTerminal(args);
                }
            }
        );
    }

    /**
     * Create a new terminal.
     * 
     * T1-2: Validates shellPath against allowlist and cwd within workspace.
     */
    private async createTerminal(args: TerminalCreateArgs): Promise<{ success: boolean; terminalId: string; error?: string }> {
        try {
            const allowedShells = getAllowedShells();
            
            // T1-2: Validate shellPath against allowlist
            if (args.shellPath) {
                const normalizedShellPath = path.normalize(args.shellPath);
                if (!allowedShells.some(allowed => path.normalize(allowed) === normalizedShellPath)) {
                    this.logger.warn(`[TerminalCommand] Shell not allowed: ${args.shellPath}`);
                    return {
                        success: false,
                        terminalId: '',
                        error: `Shell not allowed: ${args.shellPath}. Allowed shells: ${allowedShells.join(', ')}`
                    };
                }
            }

            // T1-2: Validate cwd is within workspace
            if (args.cwd) {
                const workspaceRoots = this.workspaceService.tryGetRoots();
                if (workspaceRoots.length > 0) {
                    const workspaceRoot = workspaceRoots[0].resource.path.fsPath();
                    
                    // Normalize and resolve the cwd path
                    const normalizedCwd = path.normalize(args.cwd);
                    const normalizedRoot = path.normalize(workspaceRoot);
                    
                    // Check if cwd is within workspace root
                    if (!normalizedCwd.startsWith(normalizedRoot) && 
                        !normalizedCwd.replace(/[\\/]/g, '/').startsWith(normalizedRoot.replace(/[\\/]/g, '/'))) {
                        this.logger.warn(`[TerminalCommand] Working directory outside workspace: ${args.cwd}`);
                        return {
                            success: false,
                            terminalId: '',
                            error: `Working directory must be within workspace: ${args.cwd}`
                        };
                    }

                    // T1-3: Resolve symlinks via Node backend (browser can't call fs.realpath)
                    if (this.openCodeService) {
                        const result = await this.openCodeService.validatePath(normalizedCwd, normalizedRoot);
                        if (!result.valid) {
                            this.logger.warn(`[TerminalCommand] cwd rejected by symlink check: ${result.error}`);
                            return {
                                success: false,
                                terminalId: '',
                                error: `Working directory rejected: ${result.error}`
                            };
                        }
                        // Use canonically resolved cwd going forward
                        args = { ...args, cwd: result.resolvedPath || normalizedCwd };
                    }
                }
            }

            const options: TerminalWidgetOptions = {
                title: args.title || 'OpenSpace Terminal',
                ...(args.cwd ? { cwd: path.normalize(args.cwd) } : {}),
                ...(args.shellPath ? { shellPath: path.normalize(args.shellPath) } : {}),
            };

            const widget = await this.terminalService.newTerminal(options);
            await widget.start();

            // Attach the widget to the shell so it appears in the UI (bottom panel)
            this.terminalService.open(widget);

            // Track the new terminal
            this.trackTerminal(widget);

            return {
                success: true,
                terminalId: widget.id
            };
        } catch (error) {
            this.logger.error('[TerminalCommand] Error creating terminal:', error);
            return {
                success: false,
                terminalId: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Send text to a terminal.
     * 
     * Per §17.3: Checks for dangerous commands and BLOCKS execution if dangerous.
     * T1-1: Dangerous commands are rejected (not just flagged).
     */
    private async sendToTerminal(args: TerminalSendArgs): Promise<{ success: boolean; dangerous?: boolean; error?: string }> {
        try {
            const widget = this.terminalWidgets.get(args.terminalId);
            if (!widget) {
                this.logger.warn(`[TerminalCommand] Terminal not found: ${args.terminalId}`);
                return { success: false };
            }

            // Check for dangerous commands per §17.3
            const dangerous = isDangerous(args.text);

            // T1-1: BLOCK execution of dangerous commands
            if (dangerous) {
                this.logger.warn(`[TerminalCommand] Dangerous command blocked: ${args.text.substring(0, 50)}...`);
                return {
                    success: false,
                    dangerous: true,
                    error: `Dangerous command blocked: ${args.text.substring(0, 30)}... Agent must request user confirmation before executing.`
                };
            }

            // Send the text to the terminal (only if not dangerous)
            // Strip any trailing newline/carriage-return before appending \r to avoid double Enter
            const textToSend = args.text.replace(/[\r\n]+$/, '');
            widget.sendText(textToSend + '\r');

            return {
                success: true,
                dangerous: false
            };
        } catch (error) {
            this.logger.error('[TerminalCommand] Error sending to terminal:', error);
            return { 
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Read terminal output from the ring buffer.
     * 
     * Per §17.9: Output is sanitized before returning.
     */
    private async readTerminalOutput(args: TerminalReadOutputArgs): Promise<{ success: boolean; output: string[] }> {
        try {
            const widget = this.terminalWidgets.get(args.terminalId);
            if (!widget) {
                this.logger.warn(`[TerminalCommand] Terminal not found: ${args.terminalId}`);
                return { success: false, output: [] };
            }

            const linesToRead = args.lines || 100;
            const rawOutput = this.ringBuffer.read(args.terminalId, linesToRead);
            
            // Sanitize output per §17.9
            const sanitizedOutput = rawOutput.map(line => sanitizeOutput(line));

            return {
                success: true,
                output: sanitizedOutput
            };
        } catch (error) {
            this.logger.error('[TerminalCommand] Error reading terminal output:', error);
            return { success: false, output: [] };
        }
    }

    /**
     * List all active terminals.
     */
    private async listTerminals(): Promise<{ success: boolean; terminals: TerminalInfo[] }> {
        try {
            const terminals: TerminalInfo[] = [];
            const currentTerminal = this.terminalService.currentTerminal;

            for (const widget of this.terminalService.all) {
                terminals.push({
                    id: widget.id,
                    title: widget.title?.label || 'Unnamed Terminal',
                    isActive: currentTerminal?.id === widget.id
                });
            }

            return {
                success: true,
                terminals
            };
        } catch (error) {
            this.logger.error('[TerminalCommand] Error listing terminals:', error);
            return { success: false, terminals: [] };
        }
    }

    /**
     * Close a terminal.
     */
    private async closeTerminal(args: TerminalCloseArgs): Promise<{ success: boolean }> {
        try {
            const widget = this.terminalWidgets.get(args.terminalId);
            if (!widget) {
                this.logger.warn(`[TerminalCommand] Terminal not found: ${args.terminalId}`);
                return { success: false };
            }

            // Close the widget — onDidDispose fires and calls untrackTerminal automatically
            await widget.close();

            return { success: true };
        } catch (error) {
            this.logger.error('[TerminalCommand] Error closing terminal:', error);
            return { success: false };
        }
    }

    /**
     * Get the ring buffer for testing purposes.
     */
    getRingBuffer(): TerminalRingBuffer {
        return this.ringBuffer;
    }

    /**
     * Get all tracked terminal widgets for testing purposes.
     */
    getTrackedTerminals(): Map<string, TerminalWidget> {
        return this.terminalWidgets;
    }
}
