// src/commands/read-aloud.ts
import * as vscode from 'vscode';
import type { KokoroAdapter, SessionFsm, NarrationFsm } from '@openspace-ai/voice-core';
import { playPcmAudio } from '../audio/playback';

interface ReadAloudDeps {
  ttsAdapter: KokoroAdapter;
  sessionFsm: SessionFsm;
  narrationFsm: NarrationFsm;
}

export function registerReadAloudCommand(
  context: vscode.ExtensionContext,
  deps: ReadAloudDeps,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('openspace-voice.readAloud', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('No active editor.');
        return;
      }

      const text = editor.document.getText(editor.selection);
      if (!text.trim()) {
        vscode.window.showInformationMessage('No text selected. Select text first.');
        return;
      }

      if (deps.sessionFsm.state === 'inactive') {
        vscode.window.showWarningMessage('OpenSpace Voice is not ready. Check setup.');
        return;
      }

      const config = vscode.workspace.getConfiguration('openspace-voice');
      const voice = config.get<string>('voice') ?? 'af_sarah';
      const speed = config.get<number>('speed') ?? 1.0;
      const language = config.get<string>('language') ?? 'en-US';

      // Wire narrationFsm lifecycle around synthesis + playback
      deps.narrationFsm.enqueue({ text, mode: 'narrate-everything', voice, speed });

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Synthesizing speech…', cancellable: true },
        async (_progress, vsToken) => {
          let cancelled = false;
          try {
            deps.narrationFsm.startProcessing();
            const result = await deps.ttsAdapter.synthesize({ text, language, voice, speed });
            if (vsToken.isCancellationRequested) {
              cancelled = true;
              deps.narrationFsm.error();
              return;
            }
            deps.narrationFsm.audioReady();
            await playPcmAudio(result.audio, result.sampleRate ?? 24000);
            deps.narrationFsm.complete();
          } catch (err) {
            if (!cancelled) {
              deps.narrationFsm.error();
              vscode.window.showErrorMessage(`Read aloud failed: ${(err as Error).message}`);
            }
          }
        }
      );
    })
  );
}
