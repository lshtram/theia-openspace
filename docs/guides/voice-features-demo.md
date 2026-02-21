# Voice Features Demo Guide

Step-by-step walkthrough to verify all voice features working end-to-end,
from simplest to most extensive.

---

## Prerequisites

| Requirement | How to check |
|---|---|
| Theia server running on port 3003 | `lsof -i :3003` should show a node process |
| OpenCode running on port 7890 | `lsof -i :7890` should show opencode |
| Microphone connected | system audio settings |
| `whisper.cpp` installed | `which whisper-cpp` or check server log for `STT: whisper.cpp` |

### Start the server (if not already running)

```bash
cd /Users/Shared/dev/theia-openspace/.worktrees/feature-voice/browser-app
THEIA_CONFIG_DIR=$(mktemp -d) node lib/backend/main.js --port 3003 --plugins=local-dir:../plugins/builtin &
```

Watch the log to confirm it started:
```bash
tail -f /tmp/theia-voice-3003.log
```

Expected lines:
```
[VoiceHub] Voice routes configured (/openspace/voice/stt, /narrate, /utterances)
[VoiceHub] Providers ready (STT: whisper.cpp, TTS: browser-synth-stub)
Theia app listening on http://127.0.0.1:3003
[BridgeContribution] Registered as command bridge
```

---

## Step 1 — Open the app

Open **http://localhost:3003** in your browser.

You should see the Theia IDE with menu bar (File, Edit, Selection, View...) and the
activity bar on the left with icons for Explorer, Search, Extensions, Sessions, Settings.

**Expected:** 0 errors in the browser console (DevTools -> Console).

---

## Step 2 — Verify voice commands are registered

1. Press **`Cmd+Shift+P`** to open the Command Palette
2. Type **`>voice`** (include the `>`)
3. You should see exactly these two commands:
   - `Voice: Set Policy`
   - `Voice: Toggle Voice Input`  (keybinding: `Ctrl+Shift+V`)

This confirms the `openspace-voice` Theia extension loaded successfully and wired
its commands into the IDE.

---

## Step 3 — Enable voice (Set Policy)

1. Command Palette (`Cmd+Shift+P`) -> type `>voice` -> select **`Voice: Set Policy`**
2. A quick-pick or input dialog appears — set:
   - `enabled`: `true`
   - `narrationMode`: `narrate-off` (keep TTS off for now)
   - `speed`: `1.0`
   - `voice`: `af_sarah`
3. Confirm / press Enter

The session FSM transitions: **`inactive` -> `active`**

The voice input keybinding `Ctrl+Shift+V` is now live.

---

## Step 4 — Toggle voice input (Speech-to-Text)

1. Press **`Ctrl+Shift+V`** (or Command Palette -> `Voice: Toggle Voice Input`)
2. Your browser shows a **microphone permission prompt** — click **Allow**
3. The audio FSM starts capturing from your microphone
4. Speak a short phrase, e.g. "open the explorer"
5. Pause for ~1 second — the recording auto-stops on silence
6. The audio FSM:
   - Encodes your speech as WebM/Opus
   - POSTs it to `/openspace/voice/stt` with header `X-Sample-Rate: 16000`
   - whisper.cpp decodes the WebM -> raw PCM -> transcribes -> returns JSON
7. The transcript text is injected into the chat input box

**What to look for in the server log:**
```bash
tail -f /tmp/theia-voice-3003.log
```
You should see an incoming POST to `/openspace/voice/stt` and a transcription result.

**What to look for in the UI:**
The chat input textarea fills with your spoken text.

---

## Step 5 — Toggle voice input off

Press **`Ctrl+Shift+V`** again (or Command Palette -> `Voice: Toggle Voice Input`).

The audio FSM stops capturing. Microphone access is released.

---

## Step 6 — Send a message via voice (full STT -> chat round-trip)

1. Make sure voice is enabled (Step 3) and voice input is on (Step 4)
2. Speak a complete question, e.g. "what files are in the project root"
3. Wait for the transcript to appear in the chat input
4. Press **Enter** to send the message to the AI agent
5. The agent processes the message and streams a reply in the chat panel

This confirms the full voice -> text -> agent pipeline works.

---

## Step 7 — Narration / Text-to-Speech (read-aloud)

> **Note:** `kokoro-js` (the WASM TTS engine) must be installed for actual audio output.
> Without it the server uses a silent stub — the full code path still runs, visible in logs.
>
> To install kokoro-js:
> ```bash
> cd /Users/Shared/dev/theia-openspace/.worktrees/feature-voice
> yarn add kokoro-js
> # then rebuild:
> yarn --cwd extensions/openspace-voice build && yarn build:browser
> ```

1. Command Palette -> **`Voice: Set Policy`** -> set `narrationMode` to **`narrate-everything`**
2. Open the Chat panel (activity bar -> chat icon, or `View -> Chat`)
3. Send any message to the AI agent
4. When the assistant reply finishes streaming, the `NarrationFsm` automatically:
   - Enqueues the full assistant text
   - POSTs to `/openspace/voice/narrate` with text, mode, voice, and speed
   - The server synthesizes audio chunks and streams them back
   - Audio chunks are played sequentially in the browser

**What to look for in the server log:**
```
[NarrationFsm] idle -> synthesizing
[NarrationFsm] synthesizing -> playing
[NarrationFsm] playing -> idle
```

**With kokoro-js installed:** you will hear the assistant reply read aloud.
**Without kokoro-js:** the cycle completes silently (stub returns empty audio).

---

## Step 8 — Stop narration mid-stream

While a narration is playing (or synthesizing):

1. Open Command Palette -> **`Voice: Stop Narration`**
2. The FSM immediately transitions to `idle`
3. Any queued narration items are cleared
4. Audio playback stops

---

## Step 9 — Narrate summary only

1. Command Palette -> **`Voice: Set Policy`** -> set `narrationMode` to **`narrate-summary`**
2. Send a long message to the agent (e.g. paste a block of code and ask for an explanation)
3. Instead of reading the full reply, the narration FSM sends the text with mode `narrate-summary`
4. The LLM condenses it to a short spoken summary before synthesizing audio

This is the highest-level voice feature — it exercises the full pipeline:
STT capture -> chat -> agent reply -> LLM narration summarizer -> TTS synthesis -> audio playback.

---

## Step 10 — Disable voice

1. Command Palette -> **`Voice: Set Policy`** -> set `enabled` to `false`
2. The session FSM returns to **`inactive`**
3. `Ctrl+Shift+V` is now a no-op
4. Narration triggers on new messages are suppressed

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `403 Forbidden` on `/openspace/register-bridge` | Server port not in CORS whitelist | Restart with `OPENSPACE_HUB_ORIGINS=http://localhost:3003,http://127.0.0.1:3003` |
| `Voice: Toggle Voice Input` does nothing | Voice not enabled | Run `Voice: Set Policy` -> `enabled: true` first |
| No transcript after speaking | whisper.cpp not found or audio too short | Check server log; speak for at least 1 second |
| Narration silent | `kokoro-js` not installed | Install it (see Step 7 note) or check stub log entries |
| Bridge 403 on state publish | OpenCode not running | Start `opencode` — it must be running on port 7890 |

---

## Server log

```bash
tail -f /tmp/theia-voice-3003.log
```

## Useful commands

```bash
# Check server is running
lsof -i :3003

# Check OpenCode is running
lsof -i :7890

# Kill the voice server
pkill -f "main.js --port 3003"

# Rebuild after code changes
cd /Users/Shared/dev/theia-openspace/.worktrees/feature-voice
yarn build:extensions && yarn build:browser
```
