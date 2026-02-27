// extensions/openspace-voice/src/browser/voice-command-contribution.ts
import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common/command';
import { KeybindingContribution, KeybindingRegistry } from '@theia/core/lib/browser/keybinding';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { StatusBar, StatusBarAlignment } from '@theia/core/lib/browser/status-bar/status-bar';
import { QuickPickService, QuickPickValue } from '@theia/core/lib/common/quick-pick-service';
import { SessionFsm } from './session-fsm';
import { AudioFsm } from './audio-fsm';
import { NarrationFsm } from './narration-fsm';
import { VoiceWaveformOverlay } from './voice-waveform-overlay';
import { VoiceTextProcessor } from './voice-text-processor';
import type { VoicePolicy } from '../common/voice-policy';
import { NARRATION_MODES, SUPPORTED_LANGUAGES, SUPPORTED_VOICES } from '../common/voice-policy';

export const VOICE_COMMANDS = {
  TOGGLE_VOICE:    { id: 'openspace.voice.toggle',         label: 'Voice: Toggle Voice Input' },
  SET_POLICY:      { id: 'openspace.voice.set_policy',     label: 'Voice: Set Policy' },
  SET_VOCABULARY:  { id: 'openspace.voice.set_vocabulary', label: 'Voice: Edit Vocabulary' },
  STOP_NARRATION:  { id: 'openspace.voice.stop_narration', label: 'Voice: Stop Narration' },
};

const STATUS_BAR_ID = 'openspace-voice-status';

@injectable()
export class VoiceCommandContribution
  implements CommandContribution, KeybindingContribution, FrontendApplicationContribution {

  @inject(SessionFsm)       private readonly sessionFsm!: SessionFsm;
  @inject(AudioFsm)         private readonly audioFsm!: AudioFsm;
  @inject(NarrationFsm)     private readonly narrationFsm!: NarrationFsm;
  @inject(QuickPickService)  private readonly quickPickService!: QuickPickService;
  private readonly textProcessor = new VoiceTextProcessor();
  @inject(StatusBar)         private readonly statusBar!: StatusBar;

  private recording = false;

  private readonly waveformOverlay = new VoiceWaveformOverlay();

  pushVolumeData(data: Uint8Array): void {
    this.waveformOverlay.push(data);
  }

  setEmotion(emotion: import('../common/narration-types').EmotionKind | null): void {
    this.waveformOverlay.setEmotion(emotion);
  }

  setVoiceMode(mode: 'idle' | 'waiting' | 'speaking'): void {
    if (mode === 'idle') {
      this.waveformOverlay.hide();
    } else {
      this.waveformOverlay.setMode(mode);
      this.waveformOverlay.show();
    }
  }

  // ── FrontendApplicationContribution ──────────────────────────────────────

  onStart(): void {
    console.log('[Voice] onStart - policy.enabled:', this.sessionFsm.policy.enabled, 'state:', this.sessionFsm.state);
    // Sync FSM state with policy: if policy says enabled, ensure FSM is enabled
    if (this.sessionFsm.policy.enabled && this.sessionFsm.state === 'inactive') {
      this.sessionFsm.enable();
      console.log('[Voice] Enabled voice from policy');
    }
    this.updateStatusBar();
    this.waveformOverlay.setOnCancel(() => this.narrationFsm.stop());
  }

  // ── CommandContribution ───────────────────────────────────────────────────

  registerCommands(registry: CommandRegistry): void {

    registry.registerCommand(VOICE_COMMANDS.TOGGLE_VOICE, {
      execute: async () => {
        // If voice is not enabled, enable it first
        if (this.sessionFsm.state === 'inactive') {
          this.sessionFsm.enable();
        }

        if (!this.recording) {
          // Start recording
          this.recording = true;
          this.sessionFsm.pushToTalkStart();
          this.updateStatusBar();
          try {
            await this.audioFsm.startCapture();
            this.waveformOverlay.setMode('recording');
            this.waveformOverlay.show();
          } catch (err) {
            console.error('[VoiceInput] startCapture failed:', err);
            this.recording = false;
            this.sessionFsm.pushToTalkEnd();
            this.updateStatusBar();
            this.waveformOverlay.hide();
          }
        } else {
          // Stop recording and transcribe
          this.recording = false;
          this.updateStatusBar();
          try {
            await this.audioFsm.stopCapture();
          } catch (err) {
            console.error('[VoiceInput] stopCapture failed:', err);
          }
          this.sessionFsm.pushToTalkEnd();
          this.updateStatusBar();
          this.waveformOverlay.hide();
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
        this.updateStatusBar();
      },
    });

    registry.registerCommand(VOICE_COMMANDS.SET_VOCABULARY, {
      execute: async () => {
        await this.showVocabularyEditor();
      },
    });

    registry.registerCommand(VOICE_COMMANDS.STOP_NARRATION, {
      execute: () => {
        this.narrationFsm.stop();
        this.updateStatusBar();
      },
    });
  }

  // ── KeybindingContribution ────────────────────────────────────────────────

  registerKeybindings(registry: KeybindingRegistry): void {
    registry.registerKeybinding({
      command: VOICE_COMMANDS.TOGGLE_VOICE.id,
      keybinding: 'ctrl+m',
    });
  }

  // ── Status bar ────────────────────────────────────────────────────────────

  private updateStatusBar(): void {
    const voiceEnabled = this.sessionFsm.state !== 'inactive';

    if (!voiceEnabled) {
      this.statusBar.setElement(STATUS_BAR_ID, {
        text: '$(mic-off) Voice off',
        tooltip: 'Voice disabled — run "Voice: Set Policy" to enable',
        alignment: StatusBarAlignment.RIGHT,
        priority: 200,
        command: VOICE_COMMANDS.SET_POLICY.id,
      });
      return;
    }

    if (this.recording) {
      this.statusBar.setElement(STATUS_BAR_ID, {
        text: '$(record) REC',
        tooltip: 'Recording… press Ctrl+M again to stop and transcribe',
        alignment: StatusBarAlignment.RIGHT,
        priority: 200,
        color: '#e53e3e',
        command: VOICE_COMMANDS.TOGGLE_VOICE.id,
      });
      return;
    }

    this.statusBar.setElement(STATUS_BAR_ID, {
      text: '$(mic) Voice ready',
      tooltip: 'Press Ctrl+M to start recording',
      alignment: StatusBarAlignment.RIGHT,
      priority: 200,
      command: VOICE_COMMANDS.TOGGLE_VOICE.id,
    });
  }

  // ── Interactive Policy Wizard ─────────────────────────────────────────────

  private async showPolicyWizard(): Promise<void> {
    const current = this.sessionFsm.policy;

    // Step 0: language (auto-detect toggle or manual selection)
    const autoDetectChoice = await this.quickPickService.show<QuickPickValue<boolean>>(
      [
        {
          label: 'Auto-detect language',
          description: 'Whisper will automatically detect the language from your speech',
          value: true,
          ...(current.autoDetectLanguage ? { detail: '✓ current' } : {}),
        },
        {
          label: 'Select language manually',
          description: 'Choose a specific language for better accuracy',
          value: false,
          ...(!current.autoDetectLanguage ? { detail: '✓ current' } : {}),
        },
      ],
      { title: 'Voice Policy (1/5) — Language' }
    );
    if (autoDetectChoice === undefined) { return; }

    let selectedLanguage = current.language;
    if (!autoDetectChoice.value) {
      const langChoice = await this.quickPickService.show<QuickPickValue<string>>(
        SUPPORTED_LANGUAGES.map((lang: { code: string; name: string }) => ({
          label: lang.name,
          description: lang.code,
          value: lang.code,
          ...(lang.code === current.language ? { detail: '✓ current' } : {}),
        })),
        { title: 'Select Language', placeholder: 'Search languages...' }
      );
      if (langChoice === undefined) { return; }
      selectedLanguage = langChoice.value;
    }

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
      { title: 'Voice Policy (2/5) — Enable voice?' }
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
      { title: 'Voice Policy (3/5) — Narration mode' }
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
      { title: 'Voice Policy (4/5) — Playback speed' }
    );
    if (speedChoice === undefined) { return; }

    // Step 4: voice
    const voiceChoice = await this.quickPickService.show<QuickPickValue<string>>(
      SUPPORTED_VOICES.map(voiceId => ({
        label: voiceId,
        value: voiceId,
        ...(voiceId === current.voice ? { detail: '✓ current' } : {}),
      })),
      { title: 'Voice Policy (5/5) — Voice selection', placeholder: 'Select a voice...' }
    );
    if (voiceChoice === undefined) { return; }

    // Apply all choices
    this.sessionFsm.updatePolicy({
      enabled:            enabledChoice.value,
      narrationMode:      modeChoice.value as typeof NARRATION_MODES[number],
      speed:              speedChoice.value,
      voice:              voiceChoice.value,
      language:           selectedLanguage,
      autoDetectLanguage: autoDetectChoice.value,
    });

    // Sync FSM state to enabled flag
    if (enabledChoice.value && this.sessionFsm.state === 'inactive') {
      this.sessionFsm.enable();
    } else if (!enabledChoice.value && this.sessionFsm.state !== 'inactive') {
      this.sessionFsm.disable();
    }
  }

  // ── Vocabulary Editor ─────────────────────────────────────────────────────

  private async showVocabularyEditor(): Promise<void> {
    this.textProcessor.loadVocabulary();
    const vocab = this.textProcessor.getVocabulary();

    const choices: QuickPickValue<string>[] = [
      { label: '+ Add new word', value: '__add__' },
      ...vocab.map((v, i) => ({
        label: v.from,
        description: '→ ' + v.to,
        value: String(i),
      })),
    ];

    const selected = await this.quickPickService.show(choices, {
      title: 'Voice Vocabulary (select to edit/delete)',
      placeholder: 'Type to filter...',
    });

    if (selected === undefined) return;

    if (selected.value === '__add__') {
      await this.promptAddVocabularyEntry();
    } else {
      const idx = parseInt(selected.value, 10);
      const entry = vocab[idx];
      const action = await this.quickPickService.show<QuickPickValue<string>>(
        [
          { label: 'Edit', value: 'edit', description: 'Change "' + entry.from + '" → "' + entry.to + '"' },
          { label: 'Delete', value: 'delete', description: 'Remove "' + entry.from + '" completely' },
        ],
        { title: 'Edit "' + entry.from + '"' }
      );
      if (action === undefined) return;

      if (action.value === 'edit') {
        await this.promptAddVocabularyEntry(entry.from, entry.to);
      } else if (action.value === 'delete') {
        this.textProcessor.removeEntry(entry.from);
        await this.showVocabularyEditor();
      }
    }
  }

  private async promptAddVocabularyEntry(existingFrom?: string, existingTo?: string): Promise<void> {
    // For simplicity, we'll use a prompt via window.prompt
    // In a full implementation, this would be a proper dialog
    const from = existingFrom || window.prompt('Enter word/phrase to replace:');
    if (!from) return;

    const to = existingTo || window.prompt();
    if (to === null || to === undefined) return;

    if (!to.trim()) {
      alert('Replacement cannot be empty');
      return;
    }

    this.textProcessor.addEntry(from.trim(), to.trim());

    const addMore = confirm('Word added! Add another?');
    if (addMore) {
      await this.promptAddVocabularyEntry();
    }
  }

  processTranscript(text: string): string {
    return this.textProcessor.process(text);
  }
}
