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

import { injectable, inject } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { FrontendApplication } from '@theia/core/lib/browser/frontend-application';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser/keybinding';
import { MessageService } from '@theia/core/lib/common/message-service';
import { PreferenceService } from '@theia/core/lib/common/preferences';
import { SessionService } from 'openspace-core/lib/browser/session-service/session-service';
import { OpenspacePreferences } from 'openspace-settings/lib/browser/openspace-preferences';
import { SoundService } from './sound-service';
import { ChatWidget } from './chat-widget/chat-widget';

/**
 * Command ID for toggling the OpenSpace chat widget.
 */
export const OPENSPACE_CHAT_TOGGLE_COMMAND_ID = 'openspace-chat:toggle';

/** Custom DOM event name used to trigger inline rename from a keybinding. */
export const OPENSPACE_RENAME_SESSION_EVENT = 'openspace-rename-session';

/**
 * View contribution for the Chat widget.
 * Registers the widget in the right sidebar and opens it on startup.
 * Also subscribes to session events to show turn-complete and error toasts (N1-A, N1-B).
 */
@injectable()
export class ChatViewContribution extends AbstractViewContribution<ChatWidget> {

    @inject(SessionService)
    protected readonly sessionService!: SessionService;

    @inject(MessageService)
    protected readonly messageService!: MessageService;

    @inject(PreferenceService)
    protected readonly preferenceService!: PreferenceService;

    private readonly soundService = new SoundService();

    constructor() {
        super({
            widgetId: ChatWidget.ID,
            widgetName: ChatWidget.LABEL,
            defaultWidgetOptions: {
                area: 'right',
                rank: 500
            },
            toggleCommandId: OPENSPACE_CHAT_TOGGLE_COMMAND_ID
        });
    }

    /**
     * Called when the application starts.
     * Opens the chat widget in the right sidebar and wires notification toasts.
     */
    async onStart(_app: FrontendApplication): Promise<void> {
        console.debug('[ChatViewContribution] onStart called, opening chat widget');
        await this.openView({ activate: false, reveal: true });
        this.wireNotificationToasts();
    }

    /** N1-A: turn-complete toast; N1-B: error toast — gated by preferences. */
    private wireNotificationToasts(): void {
        // Initialise SoundService from current preference
        this.soundService.setEnabled(
            this.preferenceService.get<boolean>(OpenspacePreferences.SOUNDS_ENABLED, false)
        );
        // Track preference changes
        this.preferenceService.onPreferenceChanged(({ preferenceName }) => {
            if (preferenceName === OpenspacePreferences.SOUNDS_ENABLED) {
                this.soundService.setEnabled(
                    this.preferenceService.get<boolean>(OpenspacePreferences.SOUNDS_ENABLED, false)
                );
            }
        });

        this.sessionService.onBackgroundTurnComplete(_sessionId => {
            if (this.preferenceService.get<boolean>(OpenspacePreferences.NOTIFICATIONS_TURN_COMPLETE, true)) {
                this.messageService.info('A background session has completed.').catch(() => {});
            }
            this.soundService.play('turn-complete');
        });

        this.sessionService.onAnySessionError(({ sessionId, message }) => {
            if (this.preferenceService.get<boolean>(OpenspacePreferences.NOTIFICATIONS_ERRORS, true)) {
                const isActive = sessionId === this.sessionService.activeSession?.id;
                if (!isActive) {
                    // Only toast for background sessions — active session errors are shown inline
                    this.messageService.error(`Session error: ${message}`).catch(() => {});
                }
            }
            this.soundService.play('error');
        });
    }
}

/**
 * Registers session keyboard shortcuts:
 *  - Mod+Shift+S → New session
 *  - Mod+Shift+N → Rename active session (triggers inline edit via DOM event)
 */
@injectable()
export class ChatCommandContribution implements CommandContribution, KeybindingContribution {

    @inject(SessionService)
    protected readonly sessionService!: SessionService;

    registerCommands(registry: CommandRegistry): void {
        registry.registerCommand(
            { id: 'openspace.session.new', label: 'OpenSpace: New Session' },
            {
                execute: async () => {
                    try {
                        await this.sessionService.createSession(`Session ${new Date().toLocaleString()}`);
                    } catch (e) {
                        console.error('[ChatCommandContribution] Failed to create session:', e);
                    }
                }
            }
        );

        registry.registerCommand(
            { id: 'openspace.session.rename', label: 'OpenSpace: Rename Active Session' },
            {
                execute: () => {
                    // Dispatch a custom DOM event — ChatHeaderBar listens for this to open inline edit
                    document.dispatchEvent(new CustomEvent(OPENSPACE_RENAME_SESSION_EVENT));
                },
                isEnabled: () => !!this.sessionService.activeSession
            }
        );
    }

    registerKeybindings(registry: KeybindingRegistry): void {
        registry.registerKeybinding({
            command: 'openspace.session.new',
            keybinding: 'ctrlcmd+shift+s'
        });
        registry.registerKeybinding({
            command: 'openspace.session.rename',
            keybinding: 'ctrlcmd+shift+n'
        });
    }
}
