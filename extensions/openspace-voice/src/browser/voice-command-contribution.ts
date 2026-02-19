// extensions/openspace-voice/src/browser/voice-command-contribution.ts
import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser/keybinding';
import { SessionFsm } from './session-fsm';
import type { VoicePolicy } from '../common/voice-policy';

export const VOICE_COMMANDS = {
  TOGGLE_VOICE: { id: 'openspace.voice.toggle', label: 'Voice: Toggle Voice Input' },
  SET_POLICY: { id: 'openspace.voice.set_policy', label: 'Voice: Set Policy' },
};

@injectable()
export class VoiceCommandContribution implements CommandContribution, KeybindingContribution {
  @inject(SessionFsm) private readonly sessionFsm!: SessionFsm;

  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(VOICE_COMMANDS.TOGGLE_VOICE, {
      execute: () => {
        if (this.sessionFsm.state === 'inactive') {
          this.sessionFsm.enable();
        } else {
          this.sessionFsm.disable();
        }
      },
    });

    registry.registerCommand(VOICE_COMMANDS.SET_POLICY, {
      execute: (args: Partial<VoicePolicy>) => {
        this.sessionFsm.updatePolicy(args);
        return { success: true };
      },
    });
  }

  registerKeybindings(registry: KeybindingRegistry): void {
    registry.registerKeybinding({
      command: VOICE_COMMANDS.TOGGLE_VOICE.id,
      keybinding: 'ctrl+shift+v',
    });
  }
}
