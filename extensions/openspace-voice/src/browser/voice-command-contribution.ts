// extensions/openspace-voice/src/browser/voice-command-contribution.ts
import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser/keybinding';
import { QuickPickService, QuickPickValue } from '@theia/core/lib/common/quick-pick-service';
import { SessionFsm } from './session-fsm';
import { NarrationFsm } from './narration-fsm';
import type { VoicePolicy } from '../common/voice-policy';
import { NARRATION_MODES } from '../common/voice-policy';

export const VOICE_COMMANDS = {
  TOGGLE_VOICE:    { id: 'openspace.voice.toggle',         label: 'Voice: Toggle Voice Input' },
  SET_POLICY:      { id: 'openspace.voice.set_policy',     label: 'Voice: Set Policy' },
  STOP_NARRATION:  { id: 'openspace.voice.stop_narration', label: 'Voice: Stop Narration' },
};

@injectable()
export class VoiceCommandContribution implements CommandContribution, KeybindingContribution {
  @inject(SessionFsm)      private readonly sessionFsm!: SessionFsm;
  @inject(NarrationFsm)    private readonly narrationFsm!: NarrationFsm;
  @inject(QuickPickService) private readonly quickPickService!: QuickPickService;

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
      // Called programmatically (e.g. from MCP tools): args contains policy fields directly.
      // Called from Command Palette with no args: show interactive quick-pick wizard.
      execute: async (args?: Partial<VoicePolicy>): Promise<void> => {
        if (args && Object.keys(args).length > 0) {
          this.sessionFsm.updatePolicy(args);
          return;
        }
        await this.showPolicyWizard();
      },
    });

    registry.registerCommand(VOICE_COMMANDS.STOP_NARRATION, {
      execute: () => {
        this.narrationFsm.stop();
      },
    });
  }

  registerKeybindings(registry: KeybindingRegistry): void {
    registry.registerKeybinding({
      command: VOICE_COMMANDS.TOGGLE_VOICE.id,
      keybinding: 'ctrl+shift+v',
    });
  }

  // ── Interactive Policy Wizard ─────────────────────────────────────────────

  private async showPolicyWizard(): Promise<void> {
    const current = this.sessionFsm.policy;

    // Step 1: enable / disable
    const enabledChoice = await this.quickPickService.show<QuickPickValue<boolean>>(
      [
        {
          label: 'Enabled',
          description: 'Voice input and narration are active',
          value: true,
          ...(current.enabled ? { detail: '✓ current' } : {}),
        },
        {
          label: 'Disabled',
          description: 'Voice features are off',
          value: false,
          ...(!current.enabled ? { detail: '✓ current' } : {}),
        },
      ],
      { title: 'Voice Policy (1/3) — Enable voice?' }
    );
    if (enabledChoice === undefined) { return; }

    // Step 2: narration mode
    const modeChoice = await this.quickPickService.show<QuickPickValue<string>>(
      [
        {
          label: 'narrate-off',
          description: 'No narration — voice input only',
          value: 'narrate-off',
          ...(current.narrationMode === 'narrate-off' ? { detail: '✓ current' } : {}),
        },
        {
          label: 'narrate-everything',
          description: 'Read every assistant reply aloud in full',
          value: 'narrate-everything',
          ...(current.narrationMode === 'narrate-everything' ? { detail: '✓ current' } : {}),
        },
        {
          label: 'narrate-summary',
          description: 'Summarise replies to a short spoken sentence',
          value: 'narrate-summary',
          ...(current.narrationMode === 'narrate-summary' ? { detail: '✓ current' } : {}),
        },
      ],
      { title: 'Voice Policy (2/3) — Narration mode' }
    );
    if (modeChoice === undefined) { return; }

    // Step 3: speed
    const speedChoice = await this.quickPickService.show<QuickPickValue<number>>(
      [
        { label: '0.75×', description: 'Slower',          value: 0.75 },
        { label: '1.0×',  description: 'Normal',          value: 1.0  },
        { label: '1.25×', description: 'Slightly faster', value: 1.25 },
        { label: '1.5×',  description: 'Fast',            value: 1.5  },
        { label: '2.0×',  description: 'Very fast',       value: 2.0  },
      ].map(item => ({
        ...item,
        ...(item.value === current.speed ? { detail: '✓ current' } : {}),
      })),
      { title: 'Voice Policy (3/3) — Playback speed' }
    );
    if (speedChoice === undefined) { return; }

    // Apply all choices
    this.sessionFsm.updatePolicy({
      enabled:       enabledChoice.value,
      narrationMode: modeChoice.value as typeof NARRATION_MODES[number],
      speed:         speedChoice.value,
    });

    // Sync FSM state to enabled flag
    if (enabledChoice.value && this.sessionFsm.state === 'inactive') {
      this.sessionFsm.enable();
    } else if (!enabledChoice.value && this.sessionFsm.state !== 'inactive') {
      this.sessionFsm.disable();
    }
  }
}
