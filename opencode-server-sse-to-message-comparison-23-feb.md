# SSE → Widget: Message Flow Comparison
**Date:** 2026-02-23  
**Purpose:** Architectural comparison of how an event emitted by the OpenCode server travels to the rendered widget — in the OpenCode native app vs. our Theia OpenSpace implementation.

---

## Overview

Both systems consume the same OpenCode HTTP server and the same SSE event stream (`GET /event`). From there the paths diverge significantly due to the different host environments: OpenCode's own app runs in a plain browser/Tauri WebView with direct HTTP access, while Theia OpenSpace runs inside a multi-process Theia IDE where the browser extension cannot reach the backend directly.

---

## Step-by-Step Comparison

| # | Step | OpenCode Native App | Theia OpenSpace | Diff / Commentary |
|---|------|---------------------|-----------------|-------------------|
| **1** | **SSE source — server emits event** | `packages/opencode/src/server/server.ts:504`  `GET /event` — Hono's `streamSSE` pushes every internal `Bus` event directly onto the HTTP stream as a JSON-encoded SSE frame. The Bus is an in-process pub/sub; any server-side module calls `Bus.publish(...)` and the SSE handler forwards it verbatim. | `extensions/openspace-core/src/node/opencode-proxy.ts:683`  Same endpoint, same event format. The proxy opens a persistent SSE connection to the OpenCode server using Node's native `http`/`https`. | **Identical at the protocol level.** Both connect to the same `GET /event?directory=...` endpoint. The difference starts immediately after: OpenCode's browser JS connects directly; our Node proxy connects on behalf of the browser. |
| **2** | **SSE reception and parsing** | `packages/app/src/context/global-sdk.tsx:100–131`  `GlobalSDKProvider` runs an `async for await` loop over `eventSdk.global.event()` — a typed async iterator provided by `@opencode-ai/sdk`. The SDK handles `EventSource`/`fetch`-based streaming internally, parses SSE lines, and yields typed `Event` objects. | `extensions/openspace-core/src/node/opencode-proxy.ts` uses `eventsource-parser` (a Node.js library) to parse the raw SSE byte stream chunk by chunk, then routes each `data:` line via `handleSSEEvent(...)`. | **Different layers, same result.** OpenCode uses its own typed SDK client (ESM, browser-native). We use a separate `eventsource-parser` npm package because Theia's Node backend cannot import the ESM SDK. Both parse the `data: {...}` lines and recover the JSON event. |
| **3** | **Event coalescing / batching before dispatch** | `packages/app/src/context/global-sdk.tsx:57–86`  Before emitting, events are coalesced: `message.part.updated` for the same `(messageID, partID)` replaces any earlier queued copy; `session.status` for the same `sessionID` replaces earlier copies. A 16 ms flush timer batches all accumulated events into a single SolidJS `batch(...)` call, preventing redundant reactive recalculations. | **No equivalent step.** Events are dispatched immediately one-by-one as they arrive from the SSE parser. Each event triggers an independent RPC callback to the frontend. | **Design difference — performance trade-off.** OpenCode batches because SolidJS reactive primitives re-run synchronously on each write; batching prevents O(n) cascades during a burst of deltas. React (our widget) does its own batching in the event loop (React 18 automatic batching) so the explicit coalescing step was less critical for us. The deduplication of `message.part.updated` for the same part is also absent on our side — we rely on the fact that `partial` events carry the full part snapshot (upsert semantics). |
| **4** | **Event routing to per-directory store** | `packages/app/src/context/global-sync.tsx:256–293`  The `GlobalSDKProvider` emitter fires with the event's `directory` tag. `GlobalSyncProvider` listens and routes: events tagged `"global"` go to `applyGlobalEvent()`; events tagged with a project directory go to `applyDirectoryEvent()` for the matching child store. | `extensions/openspace-core/src/node/opencode-proxy.ts:778`  `handleSSEEvent` inspects `event.type` and calls `forwardMessageEvent(...)` for `message.*` events, or handles `session.status` inline. There is no directory-level fan-out because Theia OpenSpace connects to one OpenCode instance per workspace. | **Structural difference — multi-project support.** OpenCode's app manages multiple projects simultaneously in the same browser session and needs per-directory stores. Our Theia extension is always scoped to a single workspace directory, so there is no routing fan-out. The simpler design is correct for our use case and significantly reduces complexity. |
| **5** | **Event applied to reactive store** | `packages/app/src/context/global-sync/event-reducer.ts`  Pure function `applyDirectoryEvent(event, store, setStore, ...)` handles each event type with a `switch`. For `message.part.updated`: binary-searches the `store.part[messageID]` array and either reconciles the existing entry or inserts at the sorted position. For `message.part.delta`: appends `props.delta` directly to the part's field in the SolidJS store via `produce`. For `message.updated`: upserts the message in `store.message[sessionID]`. | `extensions/openspace-core/src/browser/opencode-sync-service.ts:298` (`onMessageEvent`) and `:482` (`onMessagePartDelta`).  `handleMessagePartial(...)` upserts tool parts and stubs for text/reasoning parts in `SessionService`. `onMessagePartDelta(...)` dedupes back-to-back identical deltas and calls `SessionService.applyPartDelta(...)`. `handleMessageCompleted(...)` marks streaming done and re-fetches the canonical message from the backend. | **Architecturally parallel but different mechanics.** OpenCode applies deltas directly in the store (one write path for both snapshot and delta). We split into two separate callbacks (`onMessageEvent` for snapshots, `onMessagePartDelta` for streaming tokens). OpenCode's approach is simpler: one event type per operation. Our split exists because the RPC channel (Theia JSON-RPC) does not support async iterators, so we had to model streaming as discrete push callbacks. |
| **6** | **Delta accumulation into part text** | `packages/app/src/context/global-sync/event-reducer.ts:234–251`  In the `message.part.delta` handler: `part[field] = (existing ?? "") + props.delta` — a direct string append inside a SolidJS `produce` block. The store is mutated in place; SolidJS's fine-grained reactivity updates only the text node that reads this field. | `extensions/openspace-core/src/browser/session-service.ts:1308`  `applyPartDelta(messageId, partId, field, delta)` finds the part and appends `delta` to its `text`/`thinking` field. The updated message is stored in a `Map`. The SyncService additionally deduplicates back-to-back identical delta values before calling this method. | **Functionally identical.** Both append the delta string to the part's text field. The key difference is that OpenCode does it in a single atomic store write (SolidJS `produce`) while we go through a method call on `SessionService` which then fires an `onMessagesChanged` event that React subscribes to. Our deduplication guard (identical consecutive deltas) is an extra step absent from OpenCode — it was added to defend against a specific bug where the SSE stream occasionally sent the same delta twice. |
| **7** | **Cross-process transport (Node → browser)** | **Does not exist.** The OpenCode native app runs entirely in one process (browser JS / Tauri WebView). The SSE connection is made directly from the browser context. There is no intermediate server process. | `extensions/openspace-core/src/node/opencode-proxy.ts` → Theia JSON-RPC → `extensions/openspace-core/src/browser/opencode-sync-service.ts`.  The Node backend receives SSE, calls `this.client.onMessageEvent(...)` or `this.client.onMessagePartDelta(...)` where `this.client` is a Theia JSON-RPC proxy. The call is serialized, sent over a WebSocket to the browser, deserialized, and delivered to `OpenCodeSyncServiceImpl`. | **Fundamental architectural difference — the reason our pipeline is longer.** This extra hop exists because Theia's browser extension sandbox cannot make arbitrary HTTP requests to external servers; all backend I/O must go through Theia's Node backend process. The JSON-RPC channel is bi-directional and efficient, but it adds serialization overhead and one extra async boundary per event. This is the core trade-off of building inside Theia vs. a standalone app. |
| **8** | **Frontend state container** | `packages/app/src/context/global-sync.tsx` (SolidJS `createStore`).  Messages live in `store.message[sessionID]`, parts in `store.part[messageID]`. The store is a SolidJS reactive store — fine-grained signals at the field level. Reading `store.part[msgId][i].text` inside a component creates a precise subscription; only the exact text node re-renders when that string changes. | `extensions/openspace-core/src/browser/session-service.ts`.  Messages are stored in a `Map<sessionId, Message[]>`. SessionService fires `onMessagesChanged` (a Theia `Emitter`) whenever data changes. | **Different reactivity models.** SolidJS's store gives field-level reactivity automatically. Our Theia setup uses a coarser manual event (`onMessagesChanged`) that causes the whole chat widget to re-evaluate `messages` state and let React's diffing handle the rest. This is less efficient for high-frequency token streaming but was simpler to implement correctly with React inside Theia's DI system. |
| **9** | **Widget subscription to state** | `packages/app/src/pages/session.tsx` and `packages/app/src/pages/session/message-timeline.tsx`.  Components call `useSync()` which returns a SolidJS accessor. Reads inside JSX are tracked automatically — no explicit subscription needed. The component re-renders only the parts that changed. | `extensions/openspace-chat/src/browser/chat-widget.tsx:486`  `this.sessionService.onMessagesChanged(...)` — an explicit event listener registered in `componentDidMount`. Fires `this.setState({ messages: ... })` which triggers a full React reconciliation of the message list. | **Explicit vs. implicit subscription.** SolidJS components are reactive by construction; OpenCode needs no subscription code. Our React widget requires an explicit `onMessagesChanged` listener. Both correctly handle unsubscription on unmount. |
| **10** | **Message timeline / turn structure rendering** | `packages/app/src/pages/session/message-timeline.tsx` + `packages/ui/src/components/session-turn.tsx`.  Uses `SessionTurn` component from the shared `@opencode-ai/ui` package. Reads `store.message[sessionID]` and `store.part[messageID]` via `useSync()`. Renders user turns and assistant turns. Tool parts are rendered inline in the turn as collapsible `BasicTool`/`GenericTool` components. Reasoning parts (`ReasoningPart`) are shown in an expandable block. Final text shown via `Markdown`. | `extensions/openspace-chat/src/browser/message-timeline.tsx`.  Reads the `messages` prop (React state from ChatWidget). Separates messages into "steps" (tool calls + reasoning) and "final answer" (last text part). Steps are grouped in a `TurnGroup` with a "Show steps" toggle. Final answer rendered separately only after the run is not active. | **Both implement a steps-vs-answer structure but differently.**  OpenCode renders everything inline in a single `SessionTurn` component with collapsible sections per part. We extract the final text part explicitly and render it in a separate `.turn-response` container, hidden until the run completes. Our motivation was to match the OpenCode TUI aesthetic (show progress, then final answer). OpenCode's UI shows everything in-flow without a hard separation. |
| **11** | **Part-level rendering (tool calls, reasoning, text)** | `packages/ui/src/components/message-part.tsx`.  `Part` component switches on `part.type`: `text` → `Markdown`, `reasoning` → collapsible `Markdown`, `tool` → `BasicTool`/`GenericTool` with input/output display, `file` → diff view, `agent` → nested session link. All parts rendered via a `For` loop over `store.part[messageID]`, reactively updating as parts are added or changed. | `extensions/openspace-chat/src/browser/message-bubble.tsx`.  `MessageBubble` switches on part type. Handles all 12 Part types (text, reasoning, tool-use, tool-result, file, image, agent, error, step-start, step-finish, snapshot, binary). `isIntermediateStep=true` mode renders step content flat (all parts). Final response mode renders only the last text part. Reasoning is hidden in completed final bubbles but shown in intermediate-step bubbles. | **Both handle the same Part taxonomy but with different rendering strategies.** Our bubble has explicit "intermediate step" vs. "final answer" modes, which OpenCode's `message-part.tsx` does not — in OpenCode the render mode is always the same and visibility is controlled by the parent turn component rather than the bubble itself. Our approach centralizes the display-mode logic in the bubble; OpenCode distributes it across turn and part components. |
| **12** | **Completion / finalization of a message** | `packages/app/src/context/global-sync/event-reducer.ts:159–178`  `message.updated` event upserts the complete `Message` object (with final metadata like token counts) into `store.message[sessionID]` via `reconcile(info)`. No special "completed" handling — the message is just updated in the store and SolidJS reactivity propagates the change to all subscribers automatically. | `extensions/openspace-core/src/browser/opencode-sync-service.ts:404`  `handleMessageCompleted(...)` explicitly marks the streaming session done, replaces the in-memory stub/final message, then issues a REST call back to the OpenCode backend (`fetchMessageFromBackend(...)`) to get the authoritative canonical parts and overwrite the accumulated streaming state. | **Key design difference — source of truth.**  OpenCode treats the SSE `message.updated` event as the complete, authoritative final state and applies it directly. We distrust the accumulated streaming state (deltas can arrive out of order or be duplicated) and do a full re-fetch from the backend REST API on completion. This is more resilient to streaming edge cases but adds a REST round-trip per completed message. It was a deliberate choice to guard against delta accumulation bugs observed during development. |

---

## Summary: Why Our Design Differs

| Concern | OpenCode App | Theia OpenSpace | Reason |
|---------|-------------|-----------------|--------|
| **SSE connection owner** | Browser JS (direct) | Node.js backend (proxy) | Theia browser extension cannot make external HTTP calls |
| **Cross-process transport** | None | Theia JSON-RPC (WebSocket) | Required by Theia's multi-process architecture |
| **Event batching / coalescing** | Yes (16 ms flush, per-part dedup) | No | React 18 auto-batching reduces the need; simpler implementation |
| **Multi-project fan-out** | Yes (per-directory child stores) | No (single workspace) | We only support one workspace per Theia instance |
| **Reactivity model** | SolidJS fine-grained signals | React state + manual event | Theia uses React; SolidJS is OpenCode's choice |
| **Delta application** | Direct store mutation (`produce`) | `SessionService.applyPartDelta()` via callback | Our RPC model required explicit method calls rather than in-place store writes |
| **Message finalization** | Trust SSE event, upsert in store | Re-fetch REST API for canonical state | Defensive design after observing delta ordering issues |
| **Render mode per part** | Uniform (parent controls visibility) | Dual mode per bubble (step vs. final) | We separated "in-progress steps" from "final answer" at the bubble level |

The fundamental architectural difference is the **Node proxy + JSON-RPC hop** (Steps 2–3 and 7). This exists entirely because Theia's browser extension sandbox cannot hold persistent HTTP connections to external services. Every other difference downstream (explicit subscriptions, separate callbacks, re-fetch on completion) is either a consequence of this constraint or a defensive measure added during implementation.

---

## Architectural Assessment

### Overall verdict

The implementation is **structurally sound**. The forced Node proxy + JSON-RPC architecture is the only viable design inside Theia's constraints, and the defensive coding throughout is of high quality. Three genuine weak points are worth tracking.

---

### What is genuinely solid

**The forced architecture is correct.** The Node.js proxy → JSON-RPC → browser hop cannot be avoided. Theia's frontend runs in a sandboxed browser context with no direct TCP access, and `@opencode-ai/sdk` is ESM-only and cannot run in Theia's CJS Node backend. The design is the only viable solution.

**Exponential backoff with directory capture guard** (`opencode-proxy.ts:650–677`). If the user switches projects while a reconnect timer is pending, the stale directory is captured at timer-creation time and compared on fire — it will not reconnect to the wrong project. This is correct.

**SSE reconnect replay handled cleanly** (`opencode-sync-service.ts:721–735`). On reconnect, the server replays all deltas from the beginning. `onSSEReconnect()` clears accumulated text in `streamingMessages` first, so replayed deltas rebuild cleanly rather than doubling.

**No `isDone:true` fires more than once** (`opencode-sync-service.ts:436–461`). The `streamingMessages` map is cleared before `updateStreamingMessage(id, '', true)` fires, so repeated `message.updated` events (which the server sends for a single completed response) cannot trigger multiple completion signals.

**Pending event queue handles DI race** (`opencode-sync-service.ts:91–132`). SSE events can arrive before `setSessionService()` is wired during DI startup. Events are queued and replayed in order, with no events lost.

**RPC fallback timer as a safety net** (`session-service.ts:782–799`). If SSE fails to deliver a message within 5 seconds, the RPC result is used as a fallback. The fallback cancels itself as soon as SSE delivers anything, so under normal conditions it never fires. This is a correct defence-in-depth pattern.

---

### Three genuine weak points

#### Weak point 1 — Every completed message triggers a REST re-fetch

**Location:** `opencode-sync-service.ts:487` (`refreshCompletedMessageFromBackend`)

After every assistant message completes, a REST `GET /session/:id/message/:id` is made unconditionally. The stated reason is "to recover canonical part types/content and correct any duplicated transient stream state."

**The problem:** This is a sign that the delta pipeline is not fully trusted. It adds a network round-trip and a second `replaceMessage` call after every response, which causes the UI to re-render the completed message twice. The OpenCode native app trusts its SSE events completely and never re-fetches.

**Recommendation:** Audit whether the delta ordering bugs that originally motivated this re-fetch are still present. If `message.part.delta` + `message.part.updated` + `message.updated` are now arriving correctly and in order, remove `refreshCompletedMessageFromBackend` from `handleMessageCompleted`. This simplifies the completion path and eliminates the double-render.

---

#### Weak point 2 — Delta deduplication heuristic can silently drop legitimate tokens

**Location:** `opencode-sync-service.ts:517–532`

Duplicate deltas are discarded if the same `messageID|partID|field|delta` string arrives within 750 ms. This was added to defend against a specific bug where transient RPC reconnects caused the same delta to be sent twice.

**The problem:** The dedup key includes the *content of the delta*. Two legitimately identical tokens (e.g., two consecutive spaces in a code block, or `"\n"` twice) within the 750 ms window will have the second one silently dropped, producing corrupted output. The window is short so this is rare in practice, but it is architecturally fragile.

**Recommendation:** The correct fix is idempotent delta delivery — either use a monotonic sequence number on each delta event (if the server provides one), or track the last-seen `(partID, field, byteOffset)` triple instead of the content string. If the server does not provide sequence numbers, the safest short-term alternative is to remove the content-based dedup entirely and instead fix the upstream RPC reconnect behaviour that caused the duplicate deliveries.

---

#### Weak point 3 — `lastStreamingPartMessageId` state in the proxy is fragile

**Location:** `opencode-proxy.ts:82–98`, `opencode-proxy.ts:803–831`

The proxy maintains `lastStreamingPartMessageId` to correlate the streaming stub ID (used in `message.part.updated` events) with the final ID (used in `message.updated`). This is necessary because the OpenCode server can send these two event types with different message IDs.

**The problem:** This is semantic state tracking that belongs in the sync service, not in the proxy. The proxy's job is transport; state correlation is a domain concern. If a `message.updated` event arrives for a user message between the last `message.part.updated` and the next assistant `message.updated`, the guard at `opencode-proxy.ts:824` prevents premature clearing — but the logic is subtle and has already required one documented fix. More importantly, if an SSE reconnect happens mid-stream, `lastStreamingPartMessageId` is not cleared, so the stale stub ID is carried into the post-reconnect `message.updated` event.

**Recommendation:** Move ID correlation into `OpenCodeSyncServiceImpl`. The proxy should forward both the streaming part `messageID` and the final `messageID` on every event (or forward them raw and let the sync service correlate). The proxy should not maintain semantic streaming state beyond what is required for pure transport.

---

### Comparison with other IDE extensions

The two closest comparable systems are **Cursor** and **Continue.dev** (VS Code), and **GitHub Copilot Chat** (VS Code). All three use a local language server or backend process (Node.js extension host) to bridge from the browser-sandboxed extension context to the network — exactly the same structural choice made here. None of them handle a live SSE stream with per-token streaming deltas into a browser widget the way we do; all use request-response completion patterns. Our pipeline is structurally the same but more complex due to SSE streaming, and the additional complexity is justified by the feature set.

**Conclusion:** Studying those extensions would confirm the structural choices made here are correct industry practice, but would not provide actionable improvements to the streaming path. The three weak points above are specific to our SSE streaming pipeline and are not patterns those extensions needed to solve.

---

### Recommended action order

| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| **1** | Audit and remove the defensive re-fetch in `handleMessageCompleted` if delta bugs are resolved | Small (delete + test) | Eliminates double render, simplifies completion path |
| **2** | Replace content-based delta dedup with offset/sequence-based dedup | Medium | Fixes rare corrupted output; makes dedup correct by construction |
| **3** | Move `lastStreamingPartMessageId` correlation from proxy to sync service | Medium | Separates transport from domain logic; fixes stale-ID-on-reconnect edge case |
