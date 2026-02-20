// src/commands/read-aloud.ts
import * as vscode from 'vscode';
import type { KokoroAdapter, SessionFsm } from '@openspace-ai/voice-core';
import { playPcmAudio } from '../audio/playback';

interface ReadAloudDeps {
  ttsAdapter: KokoroAdapter;
  sessionFsm: SessionFsm;
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

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Synthesizing speech…', cancellable: true },
        async (_progress, token) => {
          try {
            const result = await deps.ttsAdapter.synthesize({ text, language, voice, speed });
            if (token.isCancellationRequested) return;
            await playPcmAudio(result.audio, result.sampleRate);
          } catch (err) {
            vscode.window.showErrorMessage(`Read aloud failed: ${(err as Error).message}`);
          }
        }
      );
    })
  );
}
