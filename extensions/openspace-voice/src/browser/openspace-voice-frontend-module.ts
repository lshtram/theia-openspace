// extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts
import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core/lib/common/command';
import { KeybindingContribution } from '@theia/core/lib/browser/keybinding';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
import { SessionService } from 'openspace-core/lib/browser/session-service/session-service';
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
      autoDetectLanguage: sessionFsm.policy.autoDetectLanguage,
      onTranscript: (text) => {
        // Get VoiceCommandContribution to process the transcript
        let processedText = text;
        try {
          const contrib = container.get(VoiceCommandContribution);
          processedText = contrib.processTranscript(text);
        } catch (e) {
          // If contribution not ready, use raw text
          console.warn('[VoiceInput] Using raw transcript (contribution not ready)');
        }

        // Inject processed transcript into the contentEditable chat input div
        const editor = document.querySelector<HTMLElement>('.prompt-input-editor');
        if (editor) {
          editor.focus();
          // Place cursor at end
          const sel = window.getSelection();
          if (sel) {
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          // execCommand triggers React onChange for contentEditable divs —
          // same approach used by prompt-input.tsx handlePaste
          document.execCommand('insertText', false, processedText);
        } else {
          console.warn('[VoiceInput] Could not find .prompt-input-editor to inject transcript');
        }
      },
      onError: (err) => console.error('[VoiceInput] STT error:', err),
      onVolumeData: (data) => {
        try {
          const contrib = container.get(VoiceCommandContribution);
          contrib.pushVolumeData(data);
        } catch { /* contribution not yet ready */ }
      },
    });
  }).inSingletonScope();

  bind(NarrationFsm).toDynamicValue(({ container }) => {
    const sessionFsm = container.get(SessionFsm);
    const narrationFsm = new NarrationFsm({
      narrateEndpoint: '/openspace/voice/narrate',
      utteranceBaseUrl: '/openspace/voice/utterances',
      onEmotionChange: (emotion) => {
        try {
          const contrib = container.get(VoiceCommandContribution);
          contrib.setEmotion(emotion);
        } catch { /* contribution not yet ready */ }
      },
      onModeChange: (mode) => {
        try {
          const contrib = container.get(VoiceCommandContribution);
          contrib.setVoiceMode(mode);
        } catch { /* contribution not yet ready */ }
      },
    });

    // Subscribe to agent message streaming completion for narration
    const coreSessionService = container.get<{
      onMessageStreaming: (handler: (update: { messageId: string; delta: string; isDone: boolean }) => void) => { dispose: () => void };
      onMessagesChanged: (handler: (messages: unknown[]) => void) => { dispose: () => void };
      messages: Array<{ id?: string; role: string; parts?: Array<{ type?: string; text?: string }> }>;
    }>(SessionService);

    if (!coreSessionService?.onMessageStreaming) {
      return narrationFsm;
    }

    let lastNarratedMessageId: string | null = null;

    /** Extract narration text from the last assistant message and enqueue it. */
    const tryNarrate = (triggeredBy: string): void => {
      const lastAssistant = [...coreSessionService.messages].reverse().find((m) => m.role === 'assistant');
      if (!lastAssistant) return;

      // Extract text content from message parts (type === 'text' only)
      const text = lastAssistant.parts
        ?.filter((p) => p.type === 'text' && typeof p.text === 'string')
        .map((p) => p.text as string)
        .join('')
        .trim();

      console.log(`[Voice] tryNarrate(${triggeredBy}) - text length: ${text?.length ?? 0}`);
      if (text) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lastNarratedMessageId = (lastAssistant as any).id ?? lastNarratedMessageId;
        console.log('[Voice] Enqueueing narration, mode:', sessionFsm.policy.narrationMode, 'text preview:', text.substring(0, 80));
        narrationFsm.enqueue({
          text,
          mode: sessionFsm.policy.narrationMode,
          voice: sessionFsm.policy.voice,
          speed: sessionFsm.policy.speed,
        });
      }
    };

    /** Pending messageId awaiting replaceMessage before narration can read text. */
    let pendingNarrationMessageId: string | null = null;

    coreSessionService.onMessageStreaming((update) => {
      console.log('[Voice] Message streaming update - isDone:', update.isDone, 'sessionFsm.state:', sessionFsm.state, 'narrationMode:', sessionFsm.policy.narrationMode);
      if (!update.isDone) return;
      if (sessionFsm.state === 'inactive') {
        console.log('[Voice] Skipping narration - voice inactive');
        return;
      }
      if (sessionFsm.policy.narrationMode === 'narrate-off') {
        console.log('[Voice] Skipping narration - mode is narrate-off');
        return;
      }

      // Deduplicate: guard against any residual duplicate isDone:true fires for the same message
      if (update.messageId && update.messageId === lastNarratedMessageId) return;

      // The isDone:true event fires BEFORE replaceMessage() populates the message parts.
      // Defer to the next microtask so replaceMessage() has time to run.
      pendingNarrationMessageId = update.messageId;
      setTimeout(() => {
        // Another isDone for a different message may have superseded this one
        if (pendingNarrationMessageId !== update.messageId) return;
        // Already narrated by the fallback path
        if (update.messageId === lastNarratedMessageId) return;
        tryNarrate('deferred-isDone');
      }, 0);
    });

    // Fallback: if the deferred isDone still found empty parts (e.g. replaceMessage
    // ran asynchronously via refreshCompletedMessageFromBackend), trigger narration
    // when messages change.
    if (coreSessionService.onMessagesChanged) {
      coreSessionService.onMessagesChanged(() => {
        if (!pendingNarrationMessageId) return;
        if (pendingNarrationMessageId === lastNarratedMessageId) return;
        tryNarrate('onMessagesChanged-fallback');
        // Clear pending once successfully narrated
        if (pendingNarrationMessageId === lastNarratedMessageId) {
          pendingNarrationMessageId = null;
        }
      });
    }

    return narrationFsm;
  }).inSingletonScope();

  bind(VoiceCommandContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(VoiceCommandContribution);
  bind(KeybindingContribution).toService(VoiceCommandContribution);
  bind(FrontendApplicationContribution).toService(VoiceCommandContribution);

  bind(VoiceInputWidget).toSelf().inSingletonScope();
});
