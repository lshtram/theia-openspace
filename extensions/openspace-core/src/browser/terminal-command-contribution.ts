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

import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { TerminalService } from '@theia/terminal/lib/browser/base/terminal-service';
import { TerminalWidget } from '@theia/terminal/lib/browser/base/terminal-widget';
import { TerminalRingBuffer, sanitizeOutput, isDangerous } from './terminal-ring-buffer';

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
 */
@injectable()
export class TerminalCommandContribution implements CommandContribution {

    @inject(TerminalService)
    private readonly terminalService!: TerminalService;

    private readonly ringBuffer: TerminalRingBuffer;

    /**
     * Map of terminal IDs to their widgets for tracking.
     */
    private terminalWidgets: Map<string, TerminalWidget> = new Map();

    constructor() {
        this.ringBuffer = new TerminalRingBuffer(10000);
    }

    @postConstruct()
    protected init(): void {
        // Listen for terminal creation events
        this.terminalService.onDidCreateTerminal((widget: TerminalWidget) => {
            this.trackTerminal(widget);
            // Listen for output data
            widget.onData((data: string) => {
                this.ringBuffer.append(widget.id, data);
            });
            // Listen for terminal dispose/close
            widget.onDidDispose(() => {
                this.untrackTerminal(widget.id);
            });
        });

        // Track existing terminals
        for (const widget of this.terminalService.all) {
            this.trackTerminal(widget);
        }
    }

    /**
     * Track a terminal widget.
     */
    private trackTerminal(widget: TerminalWidget): void {
        this.terminalWidgets.set(widget.id, widget);
        // Also track by title for easier identification
        if (widget.title?.label) {
            // Listen for output to capture in ring buffer
            widget.onData((data: string) => {
                this.ringBuffer.append(widget.id, data);
            });
        }
    }

    /**
     * Untrack a terminal by ID.
     */
    private untrackTerminal(terminalId: string): void {
        this.terminalWidgets.delete(terminalId);
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
     */
    private async createTerminal(args: TerminalCreateArgs): Promise<{ success: boolean; terminalId: string }> {
        try {
            const options: any = {
                title: args.title || 'OpenSpace Terminal',
            };

            if (args.cwd) {
                options.cwd = args.cwd;
            }

            if (args.shellPath) {
                options.shellPath = args.shellPath;
            }

            const widget = await this.terminalService.newTerminal(options);
            await widget.start();

            // Track the new terminal
            this.trackTerminal(widget);

            return {
                success: true,
                terminalId: widget.id
            };
        } catch (error) {
            console.error('[TerminalCommand] Error creating terminal:', error);
            return {
                success: false,
                terminalId: ''
            };
        }
    }

    /**
     * Send text to a terminal.
     * 
     * Per §17.3: Checks for dangerous commands and returns confirmation flag.
     */
    private async sendToTerminal(args: TerminalSendArgs): Promise<{ success: boolean; dangerous?: boolean }> {
        try {
            const widget = this.terminalWidgets.get(args.terminalId);
            if (!widget) {
                console.warn(`[TerminalCommand] Terminal not found: ${args.terminalId}`);
                return { success: false };
            }

            // Check for dangerous commands per §17.3
            const dangerous = isDangerous(args.text);

            // Send the text to the terminal
            widget.sendText(args.text + '\r');

            return {
                success: true,
                dangerous
            };
        } catch (error) {
            console.error('[TerminalCommand] Error sending to terminal:', error);
            return { success: false };
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
                console.warn(`[TerminalCommand] Terminal not found: ${args.terminalId}`);
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
            console.error('[TerminalCommand] Error reading terminal output:', error);
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
            console.error('[TerminalCommand] Error listing terminals:', error);
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
                console.warn(`[TerminalCommand] Terminal not found: ${args.terminalId}`);
                return { success: false };
            }

            // Close the widget
            await widget.close();

            // Untrack the terminal
            this.untrackTerminal(args.terminalId);

            return { success: true };
        } catch (error) {
            console.error('[TerminalCommand] Error closing terminal:', error);
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
