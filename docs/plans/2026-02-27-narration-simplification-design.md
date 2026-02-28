# Narration Pipeline Simplification

**Date:** 2026-02-27
**Status:** Approved

## Problem

The TTS narration pipeline has a race condition: the `isDone:true` streaming event fires before `replaceMessage()` populates message parts, causing the frontend to read truncated text and send it to the TTS engine. Multiple deferral hacks (setTimeout, onMessagesChanged fallback) fail to reliably fix the timing.

The root cause is architectural: the frontend tries to read text from a reactive message store that's still being mutated by the streaming/replacement pipeline.

## Design

### Principle

Read the **rendered DOM text** instead of the message store. What the user sees = what gets spoken. Zero timing issues.

### Frontend: DOM-based narration trigger

Replace all `onMessageStreaming` / `setTimeout` / `onMessagesChanged` / `tryNarrate` machinery in `openspace-voice-frontend-module.ts` with a `MutationObserver`:

1. Observe `.message-timeline-content` for attribute mutations on descendants
2. When `message-bubble-streaming` class is removed from an `article.message-bubble-assistant`, the message is done
3. Read text from `.part-text .md-body` elements (skip `.md-code-block`)
4. Dedup via `data-message-id` attribute
5. Enqueue into existing `NarrationFsm`

~30 lines. No store coupling.

### Backend: Remove LLM preprocessor, add regex cleanup

In `voice-backend-service.ts`, replace `NarrationPreprocessor.process()` with regex text cleanup:
- Strip fenced code blocks
- Strip inline code
- Strip markdown formatting (bold, italic, headers)
- Strip URLs
- Collapse whitespace

Send cleaned text directly to TTS as a single speech segment.

Keep `narration-preprocessor.ts` for future LLM preprocessing (Phase 2: ask original LLM for narration text alongside answer).

### Unchanged

- `NarrationFsm` drain loop and audio playback — works correctly
- HTTP routes in `voice-hub-contribution.ts` — fine
- TTS/STT provider selection — fine
- All STT/AudioFsm code — unrelated

### Cleanup

- Remove all `[DIAG]` diagnostic logging from hub, backend service, preprocessor
- Remove `pendingNarrationMessageId`, `onMessageStreaming`, `onMessagesChanged` wiring

## Future (not this pass)

- **TTS audio streaming:** Send full text to TTS, but stream audio chunks back for lower latency
- **LLM preprocessing:** Either fix ephemeral session approach or have the original LLM generate narration text alongside its answer
