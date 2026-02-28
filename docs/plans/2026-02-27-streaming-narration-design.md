# Streaming Narration Design

**Goal:** Start TTS audio within ~1 second of an agent response beginning, for both `narrate-everything` and `narrate-summary` modes, without a second LLM round-trip.

**Status:** Design approved — see implementation plan `2026-02-27-streaming-narration-plan.md`

---

## Problem

The current narration pipeline has a structural latency floor:

```
isDone:true → POST /narrate → ephemeral LLM call (10–30s) → TTS → audio
```

Every narration waits for:
1. The full agent response to finish streaming
2. A second LLM round-trip (another full model call) just to reformat/summarize the text

The second LLM call alone introduces 10–30 seconds of delay before any audio plays. Users hear silence until that round-trip completes.

---

## Approach: Embedded Narration Summary Tag

The agent produces the narration summary itself, embedded at the start of its streaming response, before generating the full answer. We detect the closing tag as it streams past, and immediately fire TTS — while the full response is still being typed out.

**No second LLM call. No post-processing latency.**

### Output Format

Every agent response is instructed to begin with:

```
[NARRATION_SUMMARY]
1–2 spoken sentences summarizing the outcome. Plain English only.
[/NARRATION_SUMMARY]

Full markdown answer follows here...
```

The summary arrives within the first ~500ms of streaming (it's just 1–2 sentences at the start of the model's token output). As soon as `[/NARRATION_SUMMARY]` is detected in the stream, the frontend fires TTS on just those 1–2 sentences.

### Why This Hits ~1s

- The model begins streaming the summary tokens immediately
- `[/NARRATION_SUMMARY]` appears after ~1–2 sentences (~15–30 tokens)
- At typical streaming rates (~50 tok/s), that's ~0.3–0.6s
- TTS on 1–2 sentences via Kokoro (local) takes ~0.3–0.7s
- **Total: ~0.6–1.3s to first audio** — while the full answer is still streaming

---

## Architecture

### Three components change:

**1. Hub instructions (`hub.ts`)**
Append a narration format block to the system prompt returned by `GET /openspace/instructions`. This instructs every OpenCode agent to use the `[NARRATION_SUMMARY]` format. Since we control this endpoint, this applies to all models without touching OpenCode itself.

**2. Streaming tag extractor (`narration-tag-extractor.ts` — new)**
A small state machine that processes a rolling text buffer character-by-character, detecting the tag pattern. When `[/NARRATION_SUMMARY]` is closed, it emits the summary text. Designed to handle:
- Tags split across multiple streaming deltas
- Missing/malformed tags (graceful fallback)
- Summary containing no markdown (validation)

**3. DOM narration observer (`openspace-voice-frontend-module.ts`)**
Currently waits for `isDone:true` (the DOM `message-bubble-streaming` class being removed). Replace with a delta-based observer that:
- Subscribes to `onMessageStreaming` events for live delta text
- Runs the tag extractor on each delta
- Fires TTS immediately when the summary tag closes (fast path)
- Falls back to current behavior if `isDone:true` fires without a tag seen (all models cooperate, but fallback ensures zero regression)

### Tag stripping

The `[NARRATION_SUMMARY]...[/NARRATION_SUMMARY]` block must be stripped from the displayed message in the chat UI. This is handled in `content-part-renderer.tsx` — the `TextPart` component strips the block before rendering markdown.

---

## Mode Behavior

| Mode | Fast path behavior |
|---|---|
| `narrate-summary` | TTS fires the extracted 1–2 sentence summary. Done. No remainder narration. |
| `narrate-everything` | TTS fires the summary first (fast). When `isDone:true` fires, enqueue the full message text (minus summary block) for a second narration pass. |
| `narrate-off` | Tag extractor still strips the block from UI display. TTS skipped. |

---

## Fallback Path

If `isDone:true` fires and no tag was ever seen (model didn't comply with format):
- `narrate-summary`: skip narration entirely (no audio, no second LLM call — we accept this tradeoff)
- `narrate-everything`: fall through to the existing `POST /narrate → cleanTextForTts → TTS` path (current behavior, no regression)

This means:
- Capable models (Claude, GPT-4): always fast path
- Weak/non-compliant models: `narrate-everything` degrades gracefully to current behavior; `narrate-summary` goes silent (acceptable — the summary mode is explicitly opt-in for voice quality)

---

## System Prompt Format Instruction

Added to the end of `Hub.generateInstructions()`:

```
## Narration Format

When voice narration is active, begin every response with a 1-2 sentence spoken summary in this exact format:

[NARRATION_SUMMARY]
<summary text — plain spoken English, no markdown, no code, no lists>
[/NARRATION_SUMMARY]

Guidelines:
- Write the summary FIRST, before thinking through the full answer
- Use plain conversational language ("I've fixed the bug", "The build is failing because...")
- No technical jargon, no file paths, no code syntax
- Maximum 2 sentences, 30 words total
- Follow immediately with the full answer in normal markdown format
```

---

## What We Are NOT Doing

- **No streaming TTS** (Kokoro is fully buffered — separate effort, different scope)
- **No second LLM call** (that's the entire point)
- **No Ollama/local model dependency** (added infra complexity not needed)
- **No partial-response summarization** (summarizing incomplete text is unreliable)
- **No changes to OpenCode server code** (all changes stay in our extensions)

---

## Files Changed

| File | Change |
|---|---|
| `extensions/openspace-core/src/node/hub.ts` | Append narration format instruction to `generateInstructions()` |
| `extensions/openspace-voice/src/common/narration-tag-extractor.ts` | New: streaming tag state machine |
| `extensions/openspace-voice/src/browser/openspace-voice-frontend-module.ts` | Replace DOM observer with streaming delta subscriber + tag extractor |
| `extensions/openspace-chat/src/browser/message-bubble/content-part-renderer.tsx` | Strip `[NARRATION_SUMMARY]` block from `TextPart` before markdown render |
| `extensions/openspace-voice/src/__tests__/narration-tag-extractor.spec.ts` | New: unit tests for tag extractor |

---

## Key Invariants

1. **Tag extractor is stateless per-message** — reset on each new `messageId`
2. **Strip before render** — users never see the `[NARRATION_SUMMARY]` tags in the chat UI
3. **Fallback is current behavior** — no regression for non-compliant models
4. **NarrationFsm is unchanged** — it still receives `enqueue({ text, mode, voice, speed })`; the caller just calls it earlier with the extracted summary text
5. **No new backend routes** — the existing `POST /narrate` (→ `cleanTextForTts` → TTS) is still used for the `narrate-everything` remainder pass
