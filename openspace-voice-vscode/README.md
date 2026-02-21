# OpenSpace Voice

Push-to-talk dictation and read-aloud narration for VS Code, powered by [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (STT) and [Kokoro TTS](https://github.com/hexgrad/kokoro).

## Features

- **Push-to-talk dictation** — Record your voice and transcribe it directly into the active editor or terminal
- **Read aloud** — Select text and have it synthesized to speech
- **Configurable voice** — Choose from Kokoro TTS voices (e.g. `af_sarah`, `bm_george`)
- **Adjustable speed** — Set playback rate from 0.5× to 2.0×

## Requirements

Both dependencies must be installed before the extension can function:

### whisper.cpp

```bash
# macOS (Homebrew)
brew install whisper-cpp

# or build from source
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp && make
```

After installing, set the binary path in VS Code settings if it is not on your `PATH`:

```json
"openspace-voice.whisperPath": "/usr/local/bin/whisper"
```

### kokoro-js

```bash
npm install -g kokoro-js
```

On first use, Kokoro downloads the ONNX model (~300 MB). Subsequent runs use the cached model.

## Quick Start

1. Install the extension
2. Open a file in VS Code
3. Press `Cmd+Alt+V` (macOS) or `Ctrl+Alt+V` (Windows/Linux) to start dictation
4. Speak, then click **Stop** in the notification
5. The transcribed text is inserted at the cursor

To read selected text aloud:

1. Select text in the editor
2. Right-click → **Voice: Read Aloud**, or run `Voice: Read Aloud` from the Command Palette

## Keybinding

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Start Dictation | `Cmd+Alt+V` | `Ctrl+Alt+V` |

To change the keybinding, open **Keyboard Shortcuts** (`Cmd+K Cmd+S`) and search for `openspace-voice.startDictation`.

> **Note:** VS Code cannot distinguish left and right modifier keys. `Cmd+Alt+V` will trigger regardless of which Alt key is pressed.

## Commands

| Command | Description |
|---------|-------------|
| `Voice: Start Dictation` | Record voice and insert transcription at cursor |
| `Voice: Read Aloud` | Synthesize selected text to speech |
| `Voice: Stop Narration` | Stop current playback |
| `Voice: Configure` | Open extension settings |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `openspace-voice.whisperPath` | `"whisper"` | Path to whisper.cpp binary |
| `openspace-voice.whisperModelFolder` | `"/usr/local/share/whisper"` | Folder containing GGML model files |
| `openspace-voice.voice` | `"af_sarah"` | Kokoro TTS voice ID |
| `openspace-voice.speed` | `1.0` | Playback speed (0.5–2.0) |
| `openspace-voice.language` | `"en-US"` | BCP-47 language tag for STT |
| `openspace-voice.narrationMode` | `"narrate-off"` | Narration mode |

### Available Voices

Kokoro 82M supports the following voices (non-exhaustive):

- `af_sarah` — American English female (default)
- `bm_george` — British English male
- `af_bella`, `af_nicole` — American English female variants
- `am_adam`, `am_michael` — American English male

## Troubleshooting

**"OpenSpace Voice is not ready"**
- Run `Voice: Configure` from the Command Palette
- Verify whisper.cpp is installed: `which whisper` (or the path you configured)
- Verify kokoro-js is installed: `node -e "require('kokoro-js')"`

**Dictation produces no output**
- Ensure a microphone is connected and the OS has granted microphone access to VS Code
- `sox` (or `arecord` on Linux) must be installed — `node-record-lpcm16` depends on it:
  ```bash
  brew install sox          # macOS
  sudo apt install sox      # Linux
  ```

**Read aloud is slow on first use**
- Kokoro downloads the ONNX model (~300 MB) on first run. Subsequent calls use the cache.

## License

MIT
