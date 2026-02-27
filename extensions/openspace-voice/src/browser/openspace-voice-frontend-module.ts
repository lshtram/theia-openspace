// extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts
import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution } from '@theia/core/lib/common/command';
import { KeybindingContribution } from '@theia/core/lib/browser/keybinding';
import { FrontendApplicationContribution } from '@theia/core/lib/browser/frontend-application-contribution';
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

    // DOM-based narration trigger: observe when assistant messages finish streaming.
    // Observe document.body (always stable) instead of .message-timeline-content
    // (which can be replaced by React re-renders, orphaning a node-specific observer).
    let lastNarratedMessageId: string | null = null;

    const narrationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') continue;
        const target = mutation.target as HTMLElement;
        if (!target.matches?.('article.message-bubble-assistant')) continue;

        // We care about the streaming class being REMOVED (message is now complete)
        const wasStreaming = (mutation.oldValue ?? '').includes('message-bubble-streaming');
        const isStreaming = target.classList.contains('message-bubble-streaming');
        if (!wasStreaming || isStreaming) continue;

        // Message just finished streaming
        const messageId = target.getAttribute('data-message-id');
        if (!messageId || messageId === lastNarratedMessageId) continue;

        // Check voice state
        if (sessionFsm.state === 'inactive') continue;
        if (sessionFsm.policy.narrationMode === 'narrate-off') continue;

        // Extract text from rendered DOM (skip code blocks)
        const mdBodies = target.querySelectorAll('.message-bubble-content .part-text .md-body');
        const text = Array.from(mdBodies)
          .map(el => (el as HTMLElement).textContent ?? '')
          .join('\n')
          .trim();

        if (!text) continue;

        lastNarratedMessageId = messageId;
        console.log('[Voice] Narrating message', messageId, '- text length:', text.length);
        narrationFsm.enqueue({
          text,
          mode: sessionFsm.policy.narrationMode,
          voice: sessionFsm.policy.voice,
          speed: sessionFsm.policy.speed,
        });
      }
    });

    // Attach to document.body — always stable, survives React re-renders of child nodes.
    // subtree:true means we still catch class mutations on any descendant article element.
    narrationObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true,
      subtree: true,
    });
    console.log('[Voice] DOM narration observer attached to document.body');

    // Disconnect observer on page unload to prevent leaks
    window.addEventListener('unload', () => {
      narrationObserver.disconnect();
    });

    // Cancel narration on Esc
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && narrationFsm.state !== 'idle') {
        narrationFsm.stop();
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
