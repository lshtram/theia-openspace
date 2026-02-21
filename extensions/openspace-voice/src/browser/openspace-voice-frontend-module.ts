// extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts
import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core/lib/common/command';
import { KeybindingContribution } from '@theia/core/lib/browser/keybinding';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { SessionService } from 'openspace-core/lib/browser/session-service';
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

  bind(NarrationFsm).toDynamicValue(({ container }) => {
    const sessionFsm = container.get(SessionFsm);
    const narrationFsm = new NarrationFsm({
      narrateEndpoint: '/openspace/voice/narrate',
      utteranceBaseUrl: '/openspace/voice/utterances',
    });

    // Subscribe to agent message streaming completion for narration
    const coreSessionService = container.get<{
      onMessageStreaming: (handler: (update: { messageId: string; delta: string; isDone: boolean }) => void) => void;
      messages: Array<{ role: string; parts?: Array<{ text?: string }> }>;
    }>(SessionService);

    coreSessionService.onMessageStreaming((update) => {
      if (!update.isDone) return;
      if (sessionFsm.state === 'inactive') return;
      if (sessionFsm.policy.narrationMode === 'narrate-off') return;

      // Find the completed assistant message
      const messages = coreSessionService.messages;
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      if (!lastAssistant) return;

      // Extract text content from message parts
      const text = lastAssistant.parts
        ?.filter((p) => typeof p.text === 'string')
        .map((p) => p.text as string)
        .join('')
        .trim();

      if (text) {
        narrationFsm.enqueue({
          text,
          mode: sessionFsm.policy.narrationMode,
          voice: sessionFsm.policy.voice,
          speed: sessionFsm.policy.speed,
        });
      }
    });

    return narrationFsm;
  }).inSingletonScope();

  bind(VoiceCommandContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(VoiceCommandContribution);
  bind(KeybindingContribution).toService(VoiceCommandContribution);
  bind(FrontendApplicationContribution).toService(VoiceCommandContribution);

  bind(VoiceInputWidget).toSelf().inSingletonScope();
});
