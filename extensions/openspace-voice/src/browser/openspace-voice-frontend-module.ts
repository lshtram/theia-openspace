// extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts
import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core/lib/common/command';
import { KeybindingContribution } from '@theia/core/lib/browser/keybinding';
import { SessionFsm } from './session-fsm';
import { AudioFsm } from './audio-fsm';
import { NarrationFsm } from './narration-fsm';
import { VoiceCommandContribution } from './voice-command-contribution';
import { VoiceInputWidget } from './voice-input-widget';

export default new ContainerModule((bind) => {
  bind(SessionFsm).toSelf().inSingletonScope();

  bind(AudioFsm).toDynamicValue(({ container }) => {
    const sessionFsm = container.get(SessionFsm);
    return new AudioFsm({
      sttEndpoint: '/openspace/voice/stt',
      language: sessionFsm.policy.language,
      onTranscript: (text) => {
        // Inject transcript into chat input textarea
        const chatInput = document.querySelector<HTMLTextAreaElement>(
          '.theia-ai-chat-input textarea, [data-chat-input]'
        );
        if (chatInput) {
          chatInput.value = text;
          chatInput.dispatchEvent(new Event('input', { bubbles: true }));
          chatInput.focus();
        }
      },
      onError: (err) => console.error('[VoiceInput] STT error:', err),
    });
  }).inSingletonScope();

  bind(NarrationFsm).toDynamicValue(() => new NarrationFsm({
    narrateEndpoint: '/openspace/voice/narrate',
    utteranceBaseUrl: '/openspace/voice/utterances',
  })).inSingletonScope();

  bind(VoiceCommandContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(VoiceCommandContribution);
  bind(KeybindingContribution).toService(VoiceCommandContribution);

  bind(VoiceInputWidget).toSelf().inSingletonScope();
});
