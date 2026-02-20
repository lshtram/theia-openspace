// src/commands/dictation.ts
import * as vscode from 'vscode';
import * as record from 'node-record-lpcm16';
import type { WhisperCppAdapter, SessionFsm, AudioFsm } from '@openspace-ai/voice-core';

interface DictationDeps {
  sttAdapter: WhisperCppAdapter;
  sessionFsm: SessionFsm;
  audioFsm: AudioFsm;
}

export function registerDictationCommand(
  context: vscode.ExtensionContext,
  deps: DictationDeps,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('openspace-voice.startDictation', async () => {
      if (deps.sessionFsm.state === 'inactive') {
        vscode.window.showWarningMessage('OpenSpace Voice is not ready. Check setup.');
        return;
      }
      if (deps.audioFsm.state !== 'idle') {
        vscode.window.showInformationMessage('Dictation already in progress.');
        return;
      }

      const config = vscode.workspace.getConfiguration('openspace-voice');
      const language = config.get<string>('language') ?? 'en-US';

      const pcmChunks: Buffer[] = [];
      let recorder: ReturnType<typeof record.record> | null = null;

      try {
        deps.sessionFsm.pushToTalkStart();
        deps.audioFsm.startCapture();

        // Start recording — node-record-lpcm16 wraps sox/arecord/rec
        recorder = record.record({ sampleRate: 16000, channels: 1, audioType: 'raw' });

        recorder.stream().on('data', (chunk: Buffer) => pcmChunks.push(chunk));
        recorder.stream().on('error', (err: Error) => {
          throw err;
        });

        // Show non-modal notification while recording
        await vscode.window.showInformationMessage(
          'Recording… Click Stop when done',
          { modal: false },
          'Stop'
        );

        recorder.stop();
        deps.audioFsm.stopCapture();

        // Process audio
        const pcm = Buffer.concat(pcmChunks);
        const audio = new Uint8Array(pcm);

        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Transcribing…' },
          async () => {
            const result = await deps.sttAdapter.transcribe({ audio, sampleRate: 16000, language });
            deps.audioFsm.transcriptReady();
            deps.sessionFsm.pushToTalkEnd();

            // Insert text at cursor
            const editor = vscode.window.activeTextEditor;
            if (editor) {
              await editor.edit(eb => eb.insert(editor.selection.active, result.text));
            }
          }
        );
      } catch (err) {
        if (recorder) {
          try { recorder.stop(); } catch { /* ignore */ }
        }
        const audioState: string = deps.audioFsm.state;
        if (audioState === 'listening' || audioState === 'processing') {
          deps.audioFsm.error();
          deps.audioFsm.reset();
        }
        if (deps.sessionFsm.state === 'suspended') deps.sessionFsm.pushToTalkEnd();
        vscode.window.showErrorMessage(`Dictation failed: ${(err as Error).message}`);
      }
    })
  );
}
