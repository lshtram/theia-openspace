# Design: Narration Cancel (Esc + Waveform Click)

**Date:** 2026-02-27  
**Status:** Approved  
**Approach:** AbortController threaded through NarrationFsm (Approach A)

---

## Problem

Narration (TTS playback) has no immediate cancel path. The stop button in `VoiceInputWidget` calls
`pause()` instead of `stop()` (bug). The waveform overlay has `pointerEvents: 'none'` so it cannot
be clicked. There is no keyboard shortcut to cancel narration.

Additionally, `NarrationFsm.stop()` does not abort the in-flight HTTP streaming fetch — the backend
keeps synthesising until the connection naturally closes.

---

## Requirements (confirmed)

- Esc key cancels narration when FSM is not idle; does nothing otherwise
- Clicking the waveform overlay cancels narration
- Cancel discards all queued audio immediately (no "finish current sentence")
- Cancel feedback: silent — waveform overlay disappears, no sound or animation
- Esc does not cancel voice input (mic listening), only narration

---

## Design

### 1. `NarrationFsm` — AbortController + clean cancel

**New private field:** `_abortController: AbortController | null = null`

**`drainLoop()`:** Creates a fresh `AbortController` at the start (`this._abortController = new AbortController()`). Passes `signal` down to `fetchAndPlay()`.

**`fetchAndPlay(request, signal)`:** Passes `signal` to `fetch()`. Also checks `signal.aborted` before each `playFloat32()` call — if aborted, throws a `DOMException` with `name === 'AbortError'`.

**`stop()`:** Calls `this._abortController?.abort()` before clearing state. Sets `_abortController = null`.

**`drainLoop` catch block:** If `err.name === 'AbortError'`, transitions to `idle` and calls `onModeChange('idle')`. Does NOT call `onError`. Returns cleanly. All other errors follow the existing error path.

**Result:** Cancel is immediate, the HTTP stream is torn down, the backend stops sending, the FSM lands in `idle`.

### 2. `VoiceWaveformOverlay` — click to cancel

**New setter:** `setOnCancel(cb: (() => void) | null): void` — stores the callback.

**`show()`:** If `_onCancel` is set, applies to the container div:
- `pointerEvents: 'auto'`
- `cursor: 'pointer'`
- attaches `click` listener calling `_onCancel()`

**`hide()`:** No change to `_onCancel` — the callback persists across show/hide cycles so it remains wired when the overlay is shown again.

### 3. `VoiceCommandContribution` — overlay wiring

**`onStart()`:** After status bar init, wire the cancel callback:
```ts
this.waveformOverlay.setOnCancel(() => this.narrationFsm.stop());
```

The `narrationFsm` is injected, so this is safe inside `onStart()` (all DI is complete by then).

### 4. `openspace-voice-frontend-module.ts` — Esc key listener

Inside the `toDynamicValue` factory for `NarrationFsm`, after the observer setup, register a single global `keydown` listener:
```ts
window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && narrationFsm.state !== 'idle') {
    narrationFsm.stop();
  }
});
```

Registered once at module init time; lives for the page lifetime (no cleanup needed).

### 5. Bug fix — `VoiceInputWidget.handleStopNarration`

Change `this.narrationFsm.pause()` → `this.narrationFsm.stop()` in `handleStopNarration`.  
The `handleMicMouseDown` path keeps `pause()` (intentional: pause during PTT, not permanent stop).

---

## Files Changed

| File | Change |
|---|---|
| `narration-fsm.ts` | Add `AbortController`; thread signal through `fetchAndPlay`; abort on `stop()`; handle `AbortError` in drain loop |
| `voice-waveform-overlay.ts` | Add `setOnCancel()` setter; apply `pointerEvents`/`cursor`/click handler in `show()` when set |
| `voice-command-contribution.ts` | Wire `setOnCancel` in `onStart()` |
| `openspace-voice-frontend-module.ts` | Register global Esc `keydown` listener |
| `voice-input-widget.tsx` | Fix `handleStopNarration` to call `stop()` not `pause()` |

---

## Tests

- `narration-fsm.spec.ts`: Add tests for `stop()` during active drain — verify FSM ends in `idle`, `onError` not called, `onModeChange('idle')` called
- `narration-fsm.spec.ts`: Add test that `AbortError` from fetch does not trigger error state
- `voice-waveform-overlay.spec.ts` (new or existing): Verify `setOnCancel` + click fires callback; verify `pointerEvents` is `auto` when callback is set

---

## Out of Scope

- Auto language detection for Kokoro TTS (separate feature)
- Cancelling voice input (mic) via Esc
