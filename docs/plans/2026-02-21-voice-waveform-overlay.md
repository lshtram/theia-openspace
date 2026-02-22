# Voice Waveform Overlay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing_plans to implement this plan task-by-task.

**Goal:** Show a live waveform canvas overlay above the status bar while the user is recording, driven by real-time mic volume data from a Web Audio `AnalyserNode`.

**Architecture:** Add an `onVolumeData` callback to `AudioFsm` that fires each animation frame with raw time-domain samples from a `AnalyserNode` tapped into the live `MediaStream`. A new `VoiceWaveformOverlay` class (plain TS, no Theia widget machinery) creates/destroys a `position:fixed` canvas `<div>` injected into `document.body`, draws waveform bars on each callback, and self-destructs when recording stops. `VoiceCommandContribution` wires the two together.

**Tech Stack:** Web Audio API (`AudioContext`, `AnalyserNode`), HTML5 Canvas 2D, TypeScript, existing Theia DI

---

## Task 1: Add `onVolumeData` callback + `AnalyserNode` to `AudioFsm`

**Files:**
- Modify: `extensions/openspace-voice/src/browser/audio-fsm.ts`

Replace the entire file with the updated version. Key changes:
- Add `onVolumeData?: (data: Uint8Array) => void` to `AudioFsmOptions`
- Add private fields `analyserCtx`, `analyser`, `rafId` for the animation loop
- In `startCapture()`: after getting the `MediaStream`, set up an `AudioContext` → `createMediaStreamSource` → `createAnalyser` chain, then start a `requestAnimationFrame` loop calling `onVolumeData`
- In `stopCapture()`: cancel the RAF loop and close the analyser `AudioContext` before processing the blob

**Verify:** `yarn --cwd extensions/openspace-voice build` — should compile with zero errors.

**Commit:**
```bash
git add extensions/openspace-voice/src/browser/audio-fsm.ts
git commit -m "feat(voice): add onVolumeData callback with AnalyserNode to AudioFsm"
```

---

## Task 2: Create `VoiceWaveformOverlay`

**Files:**
- Create: `extensions/openspace-voice/src/browser/voice-waveform-overlay.ts`

Create a new file that:
- On `show()`: injects a `position:fixed` container + `<canvas>` into `document.body`; anchored bottom-right above the status bar (~28px from bottom)
- On each `push(data)` call: clears the canvas and draws a bar-chart waveform using `getByteTimeDomainData` samples (128 = silence, values diverge with sound)
- On `hide()`: removes the element from the DOM and nulls refs

**Verify:** `yarn --cwd extensions/openspace-voice build` — zero errors.

**Commit:**
```bash
git add extensions/openspace-voice/src/browser/voice-waveform-overlay.ts
git commit -m "feat(voice): add VoiceWaveformOverlay canvas widget"
```

---

## Task 3: Wire overlay into `VoiceCommandContribution`

**Files:**
- Modify: `extensions/openspace-voice/src/browser/voice-command-contribution.ts`
- Modify: `extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts`

1. **Import** `VoiceWaveformOverlay` at the top of `voice-command-contribution.ts`

2. **Add a private field** `private readonly waveformOverlay = new VoiceWaveformOverlay();`

3. **Show overlay when recording starts, hide when it stops** in the `TOGGLE_VOICE` execute handler

4. **Add public method** `pushVolumeData(data: Uint8Array)` to `VoiceCommandContribution`

5. **Pass `onVolumeData`** in `openspace-voice-frontend-module.ts` to wire the analyser data to the overlay

**Verify:** `yarn --cwd extensions/openspace-voice build` — zero errors.

**Commit:**
```bash
git add extensions/openspace-voice/src/browser/voice-command-contribution.ts \
        extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts
git commit -m "feat(voice): wire waveform overlay show/hide/push into VoiceCommandContribution"
```

---

## Task 4: Build + restart + smoke test

**Steps:**

```bash
cd /Users/Shared/dev/theia-openspace/.worktrees/feature-voice
yarn --cwd extensions/openspace-voice build && yarn build:browser
lsof -ti :3003 | xargs kill -9 2>/dev/null; sleep 1
THEIA_CONFIG_DIR=$(mktemp -d) nohup node browser-app/lib/backend/main.js \
  --port 3003 \
  --plugins=local-dir:browser-app/../plugins/builtin \
  > /tmp/theia-voice-3003.log 2>&1 &
```

Then open http://localhost:3003 in the browser:
1. Enable voice via `Voice: Set Policy`
2. Press Ctrl+M to start recording
3. Confirm: a small dark rounded box with a live red waveform appears in the bottom-right corner just above the status bar
4. Speak — bars should animate with your voice
5. Press Ctrl+M again to stop
6. Confirm: overlay disappears, transcript appears in chat input
