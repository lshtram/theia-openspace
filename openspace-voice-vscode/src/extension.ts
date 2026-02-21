// src/extension.ts
import * as vscode from 'vscode';
import {
  WhisperCppAdapter,
  KokoroAdapter,
  SessionFsm,
  AudioFsm,
  NarrationFsm,
} from '@openspace-ai/voice-core';
import { registerDictationCommand } from './commands/dictation';
import { registerReadAloudCommand } from './commands/read-aloud';

let sttAdapter: WhisperCppAdapter;
let ttsAdapter: KokoroAdapter;
let sessionFsm: SessionFsm;
let audioFsm: AudioFsm;
let narrationFsm: NarrationFsm;
let statusBar: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration('openspace-voice');
  const whisperPath = config.get<string>('whisperPath') ?? 'whisper';
  const whisperModelFolder = config.get<string>('whisperModelFolder') ?? '/usr/local/share/whisper';

  sttAdapter = new WhisperCppAdapter(whisperPath, whisperModelFolder);
  ttsAdapter = new KokoroAdapter();
  sessionFsm = new SessionFsm();
  audioFsm = new AudioFsm();
  narrationFsm = new NarrationFsm();

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = '$(sync~spin) Voice: Initializing…';
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Set context key to false -- commands show "still initializing" until ready
  await vscode.commands.executeCommand('setContext', 'openspace-voice.ready', false);

  // Register commands immediately so keybindings work, but they check ready state
  registerDictationCommand(context, { sttAdapter, sessionFsm, audioFsm });
  // M-1, L-3: Pass narrationFsm to registerReadAloudCommand
  registerReadAloudCommand(context, { ttsAdapter, sessionFsm, narrationFsm });

  // Register configure command
  context.subscriptions.push(
    vscode.commands.registerCommand('openspace-voice.configure', () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'openspace-voice');
    })
  );

  // M-1: Register stopNarration command
  context.subscriptions.push(
    vscode.commands.registerCommand('openspace-voice.stopNarration', () => {
      if (narrationFsm.state === 'playing') {
        narrationFsm.pause();
        vscode.window.showInformationMessage('Narration paused.');
      } else {
        vscode.window.showInformationMessage('No narration is currently playing.');
      }
    })
  );

  // Check providers in background -- don't block activation
  checkProviders().catch((err) => {
    console.error('[openspace-voice] Provider check failed:', err);
  });
}

async function checkProviders(): Promise<void> {
  const [sttOk, ttsOk] = await Promise.all([
    sttAdapter.isAvailable(),
    ttsAdapter.isAvailable(),
  ]);

  if (!sttOk || !ttsOk) {
    const missing = [!sttOk && 'whisper.cpp', !ttsOk && 'kokoro-js'].filter(Boolean).join(', ');
    const choice = await vscode.window.showWarningMessage(
      `OpenSpace Voice: Missing dependencies: ${missing}`,
      'Auto-install',
      'Show Instructions',
      'Already Installed'
    );
    if (choice === 'Auto-install') await runAutoInstall(missing);
    else if (choice === 'Show Instructions') showManualInstructions(missing);
    else if (choice === 'Already Installed') await recheckProviders();
    return;
  }

  // Providers ready
  if (sessionFsm.state === 'inactive') sessionFsm.enable();
  await vscode.commands.executeCommand('setContext', 'openspace-voice.ready', true);
  statusBar.text = '$(unmute) Voice: Ready';
}

async function recheckProviders(): Promise<void> {
  const [sttOk, ttsOk] = await Promise.all([sttAdapter.isAvailable(), ttsAdapter.isAvailable()]);
  if (sttOk && ttsOk) {
    if (sessionFsm.state === 'inactive') sessionFsm.enable();
    await vscode.commands.executeCommand('setContext', 'openspace-voice.ready', true);
    statusBar.text = '$(unmute) Voice: Ready';
  } else {
    vscode.window.showErrorMessage('OpenSpace Voice: Dependencies still missing after re-check.');
  }
}

async function runAutoInstall(_missing: string): Promise<void> {
  vscode.window.showInformationMessage('Auto-install: not yet implemented. Use manual instructions.');
  showManualInstructions(_missing);
}

function showManualInstructions(missing: string): void {
  const panel = vscode.window.createWebviewPanel(
    'opsnVoiceInstall', 'OpenSpace Voice Setup', vscode.ViewColumn.One,
    { enableScripts: false }
  );
  panel.webview.html = getInstallHtml(missing);
}

function getInstallHtml(missing: string): string {
  return `<!DOCTYPE html><html><body>
    <h2>OpenSpace Voice Setup</h2>
    <p>Missing: <strong>${missing}</strong></p>
    <h3>whisper.cpp</h3>
    <pre>brew install whisper-cpp   # macOS
# or build from source: https://github.com/ggerganov/whisper.cpp</pre>
    <h3>kokoro-js</h3>
    <pre>npm install -g kokoro-js</pre>
    <p>After installing, run <strong>Voice: Configure</strong> -> "Already Installed"</p>
  </body></html>`;
}

export async function deactivate(): Promise<void> {
  await ttsAdapter?.dispose();
}
